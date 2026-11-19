"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import HeaderSearch from "./header-search";
import {
  IconDashboard,
  IconLog,
  IconSparkles,
  IconMealPlans,
  IconCamera,
  IconProfile,
  IconHistory,
  IconBitewiseLogo,
} from "./icons";
import ThemeToggle from "./theme-toggle";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/log", label: "Quick Log", icon: IconLog, isCenter: true },
  { href: "/photo", label: "Photo AI", icon: IconCamera },
  { href: "/meal-plans", label: "Meal Plans", icon: IconMealPlans },
  { href: "/weekly-plan", label: "Weekly Plan", icon: IconHistory },
];

const secondaryNavigation = [
  { href: "/suggestions", label: "AI Suggestions", icon: IconSparkles },
  { href: "/history", label: "History", icon: IconHistory },
];

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
  return localStorage.getItem("bitewise_user_avatar");
}

function getServerProfileImage() {
  return null;
}

export default function AppShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const profileImage = useSyncExternalStore(
    subscribeToProfileImage,
    getProfileImage,
    getServerProfileImage,
  );

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex min-h-[100dvh] max-w-7xl">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-[var(--line)] bg-[var(--surface)] px-6 py-8 md:flex md:flex-col md:justify-between">
          <div>
            <Link
              className="active-press flex items-center gap-3 text-lg font-bold tracking-tight text-[var(--foreground)]"
              href="/dashboard"
            >
              <IconBitewiseLogo className="size-10 shadow-xs" />
              bitewise
            </Link>
            <nav className="mt-12 space-y-1.5 text-sm font-medium" aria-label="Primary navigation">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`active-press flex items-center gap-3.5 rounded-xl px-4 py-3 transition-colors ${
                      isActive
                        ? "bg-[var(--leaf-light)] font-semibold text-[var(--leaf)]"
                        : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <Icon className={`size-5 ${isActive ? "text-[var(--leaf)]" : "text-[var(--ink-muted)]"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <div className="mt-5 border-t border-[var(--line)] pt-4">
                <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">More</p>
                {secondaryNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`active-press flex items-center gap-3.5 rounded-xl px-4 py-3 transition-colors ${
                        isActive
                          ? "bg-[var(--leaf-light)] font-semibold text-[var(--leaf)]"
                          : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      <Icon className="size-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
          <div className="space-y-4">
            <ThemeToggle compact />
            <p className="border-t border-[var(--line)] pt-4 text-xs leading-5 text-[var(--ink-muted)]">
              Nutrition estimates are for tracking, not medical advice.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="w-full px-4 pb-28 pt-6 sm:px-8 md:px-10 md:pb-12 md:pt-8">
          <header className="flex items-center justify-between gap-4 border-b border-[var(--line)]/60 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--leaf)]">{eyebrow}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
                {title}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <HeaderSearch />
              <div className="md:hidden">
                <ThemeToggle compact />
              </div>
              <Link
                aria-label="Open profile"
                className={`grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border bg-[var(--surface)] shadow-xs transition-colors hover:bg-[var(--surface-muted)] ${
                  pathname.startsWith("/profile") ? "border-[var(--leaf)] text-[var(--leaf)]" : "border-[var(--line)] text-[var(--ink-muted)]"
                }`}
                href="/profile"
              >
                {profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="size-full object-cover" src={profileImage} />
                ) : (
                  <IconProfile aria-hidden="true" className="size-5" />
                )}
              </Link>
            </div>
          </header>
          <div className="mt-6">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--surface)]/90 px-2 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex max-w-md items-center justify-around">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

            if (item.isCenter) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className="active-press relative -top-3 flex flex-col items-center justify-center"
                >
                  <div className="grid size-11 place-items-center rounded-full bg-[var(--leaf)] text-[var(--on-leaf)] shadow-lg ring-4 ring-[var(--surface)]">
                    <Icon className="size-5 text-white stroke-[2.5]" />
                  </div>
                  <span className="mt-0.5 max-w-[64px] truncate text-center text-[10px] font-extrabold text-[var(--leaf)]">
                    {item.label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`active-press flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-xl px-1 py-1 transition-all ${
                  isActive
                    ? "font-semibold text-[var(--leaf)]"
                    : "text-[var(--ink-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <div
                  className={`relative flex items-center justify-center rounded-full p-1 ${
                    isActive ? "bg-[var(--leaf-light)]" : ""
                  }`}
                >
                  <Icon className={`size-4.5 ${isActive ? "text-[var(--leaf)]" : "text-[var(--ink-muted)]"}`} />
                </div>
                <span className="mt-0.5 max-w-[60px] truncate text-center text-[10px] leading-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
