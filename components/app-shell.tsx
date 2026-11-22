"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import HeaderNotifications from "./header-notifications";
import HeaderSearch from "./header-search";
import {
  IconDashboard,
  IconLog,
  IconSparkles,
  IconMealPlans,
  IconCalendar,
  IconTrendingUp,
  IconProfile,
  IconHistory,
  IconBitewiseLogo,
  IconShieldCheck,
} from "./icons";

const desktopNavigation = [
  { href: "/dashboard", label: "Today", icon: IconDashboard },
  { href: "/log", label: "Quick Log", icon: IconLog },
  { href: "/meal-plans", label: "Meal Plans", icon: IconMealPlans },
  { href: "/weekly-plan", label: "Weekly Plan", icon: IconCalendar },
  { href: "/profile/progress", label: "Progress", icon: IconTrendingUp },
  { href: "/history", label: "History", icon: IconHistory },
];

type MobileNavItem = {
  href: string;
  label: string;
  ariaLabel?: string;
  icon: typeof IconDashboard;
  isCenter?: boolean;
};

const mobileNavigation: MobileNavItem[] = [
  { href: "/dashboard", label: "Today", icon: IconDashboard },
  { href: "/meal-plans", label: "Plans", icon: IconMealPlans },
  { href: "/log", label: "Log", icon: IconLog, isCenter: true },
  { href: "/weekly-plan", label: "Weekly", ariaLabel: "Weekly Plan", icon: IconCalendar },
  { href: "/profile/progress", label: "Progress", icon: IconTrendingUp },
];

const secondaryNavigation = [
  { href: "/suggestions", label: "AI Suggestions", icon: IconSparkles },
  { href: "/profile", label: "Profile & Settings", icon: IconProfile },
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
  try {
    return localStorage.getItem("bitewise_user_avatar");
  } catch {
    return null;
  }
}

function getServerProfileImage() {
  return null;
}

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/" || pathname === "/dashboard";
  }
  if (href === "/profile") {
    return pathname === "/profile" || (pathname.startsWith("/profile/") && !pathname.startsWith("/profile/progress"));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => pathname.startsWith("/admin"));
  const profileImage = useSyncExternalStore(
    subscribeToProfileImage,
    getProfileImage,
    getServerProfileImage,
  );

  useEffect(() => {
    let active = true;
    try {
      const cached = sessionStorage.getItem("bitewise_is_admin");
      if (cached === "1" || cached === "0") {
        window.setTimeout(() => {
          if (active) setIsAdmin(cached === "1");
        }, 0);
        return () => {
          active = false;
        };
      }
    } catch {}

    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!active || !payload) return;
        const flag = payload.isAdmin === true;
        setIsAdmin(flag);
        try {
          sessionStorage.setItem("bitewise_is_admin", flag ? "1" : "0");
        } catch {}
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const updateScroll = () => setIsScrolled(window.scrollY > 8);
    const timer = window.setTimeout(updateScroll, 0);
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", updateScroll);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-[var(--leaf)] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[var(--on-leaf)] focus:shadow-lg"
      >
        Skip to content
      </a>

      <div className="mx-auto flex min-h-[100dvh] max-w-7xl">
        {/* Fixed/Sticky Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-[var(--line)] bg-[var(--surface)] px-5 py-7 md:sticky md:top-0 md:flex md:h-[100dvh] md:flex-col md:justify-between md:overflow-y-auto">
          <div>
            <Link
              className="active-press inline-flex min-h-11 items-center gap-3 text-lg font-bold tracking-tight text-[var(--foreground)]"
              href="/dashboard"
            >
              <IconBitewiseLogo className="size-10 shadow-xs" />
              bitewise
            </Link>
            <nav className="mt-9 space-y-1.5 text-sm font-medium" aria-label="Primary navigation">
              {desktopNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = isNavItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`active-press flex min-h-11 items-center gap-3.5 rounded-xl px-4 py-2.5 transition-colors ${
                      isActive
                        ? "bg-[var(--leaf-light)] font-semibold text-[var(--leaf-ink)]"
                        : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <Icon className={`size-5 shrink-0 ${isActive ? "text-[var(--leaf-ink)]" : "text-[var(--ink-muted)]"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <div className="mt-5 border-t border-[var(--line)] pt-4">
                <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">More</p>
                {secondaryNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = isNavItemActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`active-press flex min-h-11 items-center gap-3.5 rounded-xl px-4 py-2.5 transition-colors ${
                        isActive
                          ? "bg-[var(--leaf-light)] font-semibold text-[var(--leaf-ink)]"
                          : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      <Icon className={`size-5 shrink-0 ${isActive ? "text-[var(--leaf-ink)]" : "text-[var(--ink-muted)]"}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
                {isAdmin && (
                  <Link
                    href="/admin"
                    aria-current={isNavItemActive(pathname, "/admin") ? "page" : undefined}
                    className={`active-press flex min-h-11 items-center justify-between rounded-xl px-4 py-2.5 transition-colors ${
                      isNavItemActive(pathname, "/admin")
                        ? "bg-[var(--leaf-light)] font-semibold text-[var(--leaf-ink)]"
                        : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <span className="flex items-center gap-3.5">
                      <IconShieldCheck
                        className={`size-5 shrink-0 ${
                          isNavItemActive(pathname, "/admin")
                            ? "text-[var(--leaf-ink)]"
                            : "text-[var(--leaf)]"
                        }`}
                      />
                      <span>Admin Console</span>
                    </span>
                    <span className="rounded-full bg-[var(--leaf)] px-2 py-0.5 text-[10px] font-bold text-[var(--on-leaf)]">
                      Admin
                    </span>
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main id="main-content" className="min-w-0 flex-1 pb-28 md:pb-12">
          <header
            className={`sticky top-0 z-30 flex items-center justify-between gap-2 border-b px-3.5 py-2.5 transition-[background-color,border-color,box-shadow] duration-200 sm:gap-3 sm:px-8 sm:py-3.5 md:px-10 md:py-4 ${
              isScrolled
                ? "border-[var(--line)]/80 bg-[var(--surface)]/55 shadow-xs backdrop-blur-xl backdrop-saturate-150"
                : "border-[var(--line)]/60 bg-[var(--background)]/75 backdrop-blur-md"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              <Link aria-label="Bitewise home" className="active-press shrink-0 md:hidden" href="/dashboard">
                <IconBitewiseLogo className="size-8 shadow-2xs sm:size-9" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-bold uppercase tracking-wider leading-tight text-[var(--leaf)] sm:text-xs">
                  {eyebrow}
                </p>
                <h1 className="mt-0.5 line-clamp-2 text-base font-bold leading-tight tracking-tight text-[var(--foreground)] sm:line-clamp-1 sm:text-xl md:text-2xl">
                  {title}
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <HeaderSearch />
              <HeaderNotifications />
              <Link
                aria-label="Open profile and settings"
                className={`relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border bg-[var(--surface)] shadow-xs transition-colors after:absolute after:-inset-0.5 after:content-[''] hover:bg-[var(--surface-muted)] sm:size-11 sm:after:hidden ${
                  pathname.startsWith("/profile") && !pathname.startsWith("/profile/progress")
                    ? "border-[var(--leaf)] text-[var(--leaf)]"
                    : "border-[var(--border-control)] text-[var(--ink-muted)]"
                }`}
                href="/profile"
              >
                {profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="size-full object-cover" src={profileImage} />
                ) : (
                  <IconProfile className="size-4.5 sm:size-5" />
                )}
              </Link>
            </div>
          </header>
          <div className="px-4 pt-6 sm:px-8 md:px-10 md:pt-8">{children}</div>
        </main>
      </div>

      {/* Fixed Mobile Bottom Navigation Bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)]/80 bg-[var(--surface)]/72 px-2 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur-xl backdrop-saturate-150 md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex max-w-md items-center justify-around">
          {mobileNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(pathname, item.href);

            if (item.isCenter) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className="active-press relative -top-3 flex min-h-11 min-w-11 flex-col items-center justify-center px-2"
                >
                  <div className="grid size-11 place-items-center rounded-full bg-[var(--leaf)] text-[var(--on-leaf)] shadow-lg ring-4 ring-[var(--surface)]">
                    <Icon className="size-5 stroke-[2.2]" />
                  </div>
                  <span className="mt-0.5 max-w-[68px] truncate text-center text-[10px] font-extrabold text-[var(--leaf)]">
                    {item.label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.ariaLabel}
                aria-current={isActive ? "page" : undefined}
                className={`active-press flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-xl px-1 py-1 transition-colors ${
                  isActive
                    ? "font-semibold text-[var(--leaf)]"
                    : "text-[var(--ink-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <div
                  className={`relative flex items-center justify-center rounded-full px-2.5 py-1 ${
                    isActive ? "bg-[var(--leaf-light)] text-[var(--leaf-ink)]" : ""
                  }`}
                >
                  <Icon className={`size-4.5 ${isActive ? "text-[var(--leaf-ink)]" : "text-[var(--ink-muted)]"}`} />
                </div>
                <span className="mt-0.5 max-w-[68px] truncate text-center text-[10px] leading-tight">
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
