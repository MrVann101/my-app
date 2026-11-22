"use client";

import { useEffect, useState, useSyncExternalStore, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import { isInternalAuthEmail } from "@/lib/username-auth";
import {
  IconTrendingUp,
  IconHistory,
  IconCalendar,
  IconScale,
  IconZap,
  IconPalette,
  IconBell,
  IconShieldCheck,
  IconUpload,
  IconChevronRight,
} from "@/components/icons";

type ProfileOverview = {
  name: string;
  email: string;
  targetCalories: number | null;
  goal: string | null;
  isAdmin: boolean;
};

interface NavItemProps {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  badge?: string;
}

const profileImageEvent = "bitewise-profile-image-change";

function subscribeToProfileImage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(profileImageEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(profileImageEvent, onStoreChange);
  };
}

function getProfileImage() {
  try {
    return localStorage.getItem("bitewise_user_avatar");
  } catch {
    return null;
  }
}

function getServerProfileImage() {
  return null;
}

async function compressAvatarFile(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to read image file."));
      img.src = objectUrl;
    });
    const maxDimension = 256;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas image processing is unavailable.");
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function NavCard({ href, icon: Icon, title, description, badge }: NavItemProps) {
  return (
    <Link
      href={href}
      className="group active-press flex min-h-11 items-center justify-between rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs transition-colors duration-200 hover:border-[var(--leaf)] hover:bg-[var(--surface-muted)]"
    >
      <div className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--leaf)] group-hover:border-[var(--leaf)] group-hover:bg-[var(--leaf-light)] group-hover:text-[var(--leaf-ink)]">
          <Icon className="size-6" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--foreground)] group-hover:text-[var(--leaf)]">{title}</h3>
            {badge && (
              <span className="rounded-full bg-[var(--leaf-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--leaf-ink)]">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{description}</p>
        </div>
      </div>
      <div className="shrink-0 text-[var(--ink-muted)] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[var(--leaf)]">
        <IconChevronRight className="size-5" />
      </div>
    </Link>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const profileImage = useSyncExternalStore(
    subscribeToProfileImage,
    getProfileImage,
    getServerProfileImage,
  );
  const [profileOverview, setProfileOverview] = useState<ProfileOverview | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadProfileOverview() {
      try {
        const [response, { data: { user }, error: authError }] = await Promise.all([
          fetch("/api/profile"),
          createClient().auth.getUser(),
        ]);
        if (authError) throw authError;
        const payload: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof payload.error === "object" &&
            payload.error !== null &&
            "message" in payload.error &&
            typeof payload.error.message === "string"
              ? payload.error.message
              : "Unable to load your profile details.";
          throw new Error(message);
        }

        const profile =
          typeof payload === "object" &&
          payload !== null &&
          "profile" in payload &&
          typeof payload.profile === "object" &&
          payload.profile !== null
            ? payload.profile
            : null;
        const rawEmail = user?.email ?? "";
        const email = isInternalAuthEmail(rawEmail) ? "" : rawEmail;
        const name =
          typeof user?.user_metadata.username === "string"
            ? user.user_metadata.username
            : profile && "username" in profile && typeof profile.username === "string"
              ? profile.username
              : email.split("@")[0] || "Your profile";
        const target =
          profile && "target_calories" in profile && typeof profile.target_calories === "number"
            ? profile.target_calories
            : null;
        const goal =
          profile && "goal" in profile && typeof profile.goal === "string" ? profile.goal : null;
        const isAdmin =
          typeof payload === "object" &&
          payload !== null &&
          "isAdmin" in payload &&
          payload.isAdmin === true;
        if (active) setProfileOverview({ name, email, targetCalories: target, goal, isAdmin });
      } catch (reason) {
        if (active) setProfileError(reason instanceof Error ? reason.message : "Unable to load your profile details.");
      }
    }
    void loadProfileOverview();
    return () => {
      active = false;
    };
  }, []);

  async function logOut() {
    setLogoutError(null);
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "object" &&
          payload.error !== null &&
          "message" in payload.error &&
          typeof payload.error.message === "string"
            ? payload.error.message
            : "Unable to log out.";
        throw new Error(message);
      }
      try {
        const keysToClear: string[] = [];
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (
            key &&
            (key === "bitewise_user_avatar" ||
              key === "bitewise_notifications_state_v1" ||
              key === "bitewise_submitted_feedback_ids_v1" ||
              key.startsWith("bitewise_grocery_") ||
              key.startsWith("bitewise_plan_cover_"))
          ) {
            keysToClear.push(key);
          }
        }
        for (const key of keysToClear) {
          localStorage.removeItem(key);
        }
        sessionStorage.removeItem("bitewise_is_admin");
        if (typeof caches !== "undefined") {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
        }
      } catch {}
      window.dispatchEvent(new Event(profileImageEvent));
      router.replace("/login");
      router.refresh();
    } catch (reason) {
      setLogoutError(reason instanceof Error ? reason.message : "Unable to log out.");
      setIsLoggingOut(false);
    }
  }

  async function handleProfileImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImageError(null);
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image size should be less than 5MB. Choose a smaller image and try again.");
      return;
    }
    try {
      const compressedDataUrl = await compressAvatarFile(file);
      localStorage.setItem("bitewise_user_avatar", compressedDataUrl);
      window.dispatchEvent(new Event(profileImageEvent));
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Unable to save this avatar in browser storage.");
    }
  }

  function removeProfileImage() {
    try {
      localStorage.removeItem("bitewise_user_avatar");
    } catch {}
    window.dispatchEvent(new Event(profileImageEvent));
  }

  return (
    <AppShell eyebrow="Settings" title="Profile & Preferences">
      <div className="space-y-6">
        {imageError && (
          <div className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm text-[var(--coral)]" role="alert">
            {imageError}
          </div>
        )}

        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                {profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileImage}
                    alt={`${profileOverview?.name ?? "Profile"} avatar`}
                    className="size-16 rounded-full border-2 border-[var(--leaf)] object-cover shadow-md"
                  />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-full bg-[var(--leaf)] text-xl font-black uppercase text-[var(--on-leaf)] shadow-sm">
                    {(profileOverview?.name ?? "U")
                      .slice(0, 2)
                      .split("")
                      .map((character) => character.charAt(0))
                      .join("")}
                  </div>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-[var(--foreground)]">{profileOverview?.name ?? "Your profile"}</h2>
                  <span className="rounded-full border border-[var(--leaf)]/30 bg-[var(--leaf-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--leaf-ink)]">
                    Active
                  </span>
                  {profileOverview?.isAdmin && (
                    <Link
                      href="/admin"
                      className="rounded-full bg-[var(--leaf)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--on-leaf)] transition-opacity hover:opacity-90"
                    >
                      Admin
                    </Link>
                  )}
                </div>
                <p className="text-xs text-[var(--ink-muted)]">
                  {profileOverview?.email
                    ? profileOverview.email
                    : profileOverview?.name
                      ? `@${profileOverview.name}`
                      : "Signed-in account"}
                  {" · "}
                  {profileOverview?.targetCalories
                    ? `${Math.round(profileOverview.targetCalories).toLocaleString()} kcal/day target`
                    : "Set up your calorie target"}
                  {profileOverview?.goal ? ` · ${profileOverview.goal} goal` : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="active-press inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] px-4 text-xs font-bold text-[var(--foreground)] shadow-2xs transition-colors focus-within:ring-2 focus-within:ring-[var(--leaf)] hover:border-[var(--leaf)]">
                <IconUpload className="size-4 text-[var(--leaf)]" />
                <span>{profileImage ? "Change Photo" : "Upload Photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => void handleProfileImageUpload(event)}
                  className="sr-only"
                />
              </label>

              {profileImage && (
                <button
                  type="button"
                  onClick={removeProfileImage}
                  className="active-press min-h-11 rounded-xl border border-[var(--coral)]/40 bg-[var(--coral-soft)] px-4 text-xs font-bold text-[var(--coral)] transition-colors hover:opacity-85"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          {profileError && <p className="mt-4 text-sm text-[var(--coral)]" role="alert">{profileError}</p>}
        </div>

        <div className="space-y-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            Analytics &amp; Logs
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NavCard
              href="/profile/progress"
              icon={IconTrendingUp}
              title="Analytics & Progress"
              description="Weight trends, check-ins, and 30-day calorie charts."
            />
            <NavCard
              href="/history"
              icon={IconHistory}
              title="Meal & Log History"
              description="Review past 30 days of logged meals and edit entries."
            />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            Goals &amp; Targets
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NavCard
              href="/weekly-plan"
              icon={IconCalendar}
              title="Weekly Plan"
              description="Create, customize, and revisit your AI-generated meal schedule."
            />
            <NavCard
              href="/profile/body-stats"
              icon={IconScale}
              title="Body Stats & Targets"
              description="Calculate recommended calories based on your body & activity."
            />
            <NavCard
              href="/profile/recalibration"
              icon={IconZap}
              title="Adaptive Recalibration"
              description="Weekly target adjustments based on real weigh-in progress."
              badge="Smart AI"
            />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            Preferences &amp; Account
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NavCard
              href="/profile/appearance"
              icon={IconPalette}
              title="Appearance & Theme"
              description="Switch between Warm Nordic Dark & Light modes."
            />
            <NavCard
              href="/profile/notifications"
              icon={IconBell}
              title="Notifications"
              description="Configure logging reminders & streak alerts."
            />
            <NavCard
              href="/profile/account"
              icon={IconShieldCheck}
              title="Account & Security"
              description="Change password, export CSV data, policies, or delete account."
            />
            {profileOverview?.isAdmin && (
              <NavCard
                href="/admin"
                icon={IconShieldCheck}
                title="Admin Console"
                description="Review user suggestions, ratings, app stats, and public plans."
                badge="Admin"
              />
            )}
          </div>
        </div>

        <p className="px-4 pt-2 text-center text-xs leading-relaxed text-[var(--ink-muted)]">
          Bitewise provides estimates for nutritional tracking purposes and is not medical or professional nutrition advice.{" "}
          <Link className="font-semibold text-[var(--leaf)] hover:underline" href="/privacy">
            Privacy Policy
          </Link>
          {" · "}
          <Link className="font-semibold text-[var(--leaf)] hover:underline" href="/terms">
            Terms &amp; Disclaimer
          </Link>
        </p>

        <div className="border-t border-[var(--line)] pt-5">
          {logoutError && <p className="mb-3 text-sm text-[var(--coral)]" role="alert">{logoutError}</p>}
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={() => void logOut()}
            className="active-press min-h-11 w-full rounded-xl border border-[var(--coral)]/40 bg-[var(--coral-soft)] px-5 text-sm font-bold text-[var(--coral)] transition-colors hover:opacity-85 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
          >
            {isLoggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
