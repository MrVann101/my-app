"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/app-shell";
import Link from "next/link";
import {
  IconTrendingUp,
  IconHistory,
  IconScale,
  IconZap,
  IconPalette,
  IconBell,
  IconShieldCheck,
} from "@/components/icons";
import type { ComponentType, SVGProps } from "react";

interface NavItemProps {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  badge?: string;
}

function NavCard({ href, icon: Icon, title, description, badge }: NavItemProps) {
  return (
    <Link
      href={href}
      className="group active-press flex items-center justify-between rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs transition-all duration-200 hover:border-[var(--sky)] hover:bg-[var(--surface-muted)]"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--leaf)] group-hover:border-[var(--sky)] group-hover:bg-[var(--sky-soft)] group-hover:text-[var(--sky-deep)]">
          <Icon className="size-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--foreground)] group-hover:text-[var(--sky)]">{title}</h3>
            {badge && (
              <span className="rounded-full bg-[var(--sky-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--sky-deep)]">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{description}</p>
        </div>
      </div>
      <div className="text-[var(--ink-muted)] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[var(--sky)]">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

export default function ProfilePage() {
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bitewise_user_avatar");
      if (saved) setProfileImage(saved);
    }
  }, []);

  function handleProfileImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert("Image size should be less than 3MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setProfileImage(result);
        if (typeof window !== "undefined") {
          localStorage.setItem("bitewise_user_avatar", result);
          localStorage.setItem("bitewise_avatar_alex_demo", result);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  function removeProfileImage() {
    setProfileImage(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("bitewise_user_avatar");
    }
  }

  return (
    <AppShell eyebrow="Settings" title="Profile & Preferences">
      <div className="space-y-6">
        {/* User Profile Banner Header */}
        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                {profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileImage}
                    alt="Alex Demo Profile Avatar"
                    className="size-16 rounded-full object-cover border-2 border-[var(--leaf)] shadow-md"
                  />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-[var(--sky)] to-[var(--leaf)] text-xl font-black text-white shadow-sm">
                    AD
                  </div>
                )}
                <label
                  title="Upload profile picture"
                  className="absolute bottom-0 right-0 flex size-6 cursor-pointer items-center justify-center rounded-full bg-[var(--leaf)] text-white shadow-xs hover:bg-[var(--leaf-deep)] transition-transform active:scale-95"
                >
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[var(--foreground)]">Alex Demo</h2>
                  <span className="rounded-full border border-[var(--leaf)]/30 bg-[var(--leaf-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--leaf-deep)]">
                    Active
                  </span>
                </div>
                <p className="text-xs text-[var(--ink-muted)]">demo@bitewise.app • 2,200 kcal/day target</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="active-press inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--line)] shadow-2xs transition-colors">
                <svg className="size-3.5 text-[var(--leaf)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>{profileImage ? "Change Photo" : "Upload Photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageUpload}
                  className="hidden"
                />
              </label>

              {profileImage && (
                <button
                  type="button"
                  onClick={removeProfileImage}
                  className="active-press rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/10 px-3 py-2 text-xs font-bold text-[var(--coral)] hover:bg-[var(--coral)]/20 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Sections */}

        {/* Section 1: Analytics & History */}
        <div className="space-y-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            Analytics & Logs
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NavCard
              href="/profile/progress"
              icon={IconTrendingUp}
              title="Analytics & Progress"
              description="Weight trends, macro distribution, and performance charts."
            />
            <NavCard
              href="/profile/history"
              icon={IconHistory}
              title="Meal & Log History"
              description="Review past 30 days of logged meals and edit entries."
            />
          </div>
        </div>

        {/* Section 2: Goals & Targets */}
        <div className="space-y-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            Goals & Targets
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        {/* Section 3: Preferences & Account */}
        <div className="space-y-3">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            Preferences & Account
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NavCard
              href="/profile/appearance"
              icon={IconPalette}
              title="Appearance & Theme"
              description="Customize dark / light display modes."
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
              title="Account & Data"
              description="Export nutrition data or manage account."
            />
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs leading-relaxed text-[var(--ink-muted)] px-4 pt-2">
          Bitewise provides estimates for nutritional tracking purposes and is not medical or professional nutrition advice.
        </p>
      </div>
    </AppShell>
  );
}
