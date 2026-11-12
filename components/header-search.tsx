"use client";

import { useState, useMemo, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import {
  IconSearch,
  IconProfile,
  IconPalette,
  IconHistory,
  IconScale,
  IconZap,
  IconBell,
  IconShieldCheck,
  IconMealPlans,
  IconSparkles,
  IconCamera,
  IconDashboard,
} from "./icons";

type AppCommand = {
  id: string;
  title: string;
  category: "Pages & Settings" | "Features & Tools";
  keywords: string[];
  description: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const APP_COMMANDS: AppCommand[] = [
  {
    id: "profile",
    title: "Settings & Profile Hub",
    category: "Pages & Settings",
    keywords: ["settings", "profile", "account", "preferences", "hub", "alex demo"],
    description: "Main settings & profile navigation hub.",
    href: "/profile",
    icon: IconProfile,
  },
  {
    id: "appearance",
    title: "Appearance & Theme",
    category: "Pages & Settings",
    keywords: ["appearance", "theme", "dark mode", "light mode", "color", "display"],
    description: "Switch between Nordic Dark and Light display modes.",
    href: "/profile/appearance",
    icon: IconPalette,
  },
  {
    id: "history",
    title: "Meal & Log History",
    category: "Pages & Settings",
    keywords: ["history", "past logs", "30 days", "logs", "food history", "journal"],
    description: "Review past 30 days of logged meals and entries.",
    href: "/profile/history",
    icon: IconHistory,
  },
  {
    id: "body-stats",
    title: "Body Stats & Targets",
    category: "Pages & Settings",
    keywords: ["body stats", "weight", "height", "target calories", "tdee", "bmr", "calculator"],
    description: "Calculate recommended daily calories & body metrics.",
    href: "/profile/body-stats",
    icon: IconScale,
  },
  {
    id: "recalibration",
    title: "Adaptive Recalibration",
    category: "Features & Tools",
    keywords: ["recalibration", "adaptive", "weekly adjustment", "target adjustment", "ai"],
    description: "Smart weekly target adjustments based on weigh-ins.",
    href: "/profile/recalibration",
    icon: IconZap,
  },
  {
    id: "notifications",
    title: "Notification Preferences",
    category: "Pages & Settings",
    keywords: ["notifications", "reminders", "alerts", "meal alerts"],
    description: "Configure logging reminders & streak protection alerts.",
    href: "/profile/notifications",
    icon: IconBell,
  },
  {
    id: "account",
    title: "Account & Data Privacy",
    category: "Pages & Settings",
    keywords: ["account", "export", "csv", "data", "privacy", "reset"],
    description: "Export food log CSV or manage account data.",
    href: "/profile/account",
    icon: IconShieldCheck,
  },
  {
    id: "meal-plans",
    title: "Cook with Ingredients",
    category: "Pages & Settings",
    keywords: ["meal plans", "ingredients", "recipes", "cook", "my meals", "meal ideas"],
    description: "Find recipes with ingredients you already have and save your meals.",
    href: "/meal-plans",
    icon: IconMealPlans,
  },
  {
    id: "suggestions",
    title: "AI Meal Suggestions",
    category: "Features & Tools",
    keywords: ["ai suggestions", "ai meals", "ideas", "recommendations", "suggestions"],
    description: "Smart AI meal suggestions tailored to your macros.",
    href: "/suggestions",
    icon: IconSparkles,
  },
  {
    id: "photo-ai",
    title: "Photo AI Scanner",
    category: "Features & Tools",
    keywords: ["photo", "camera", "scan", "analyze photo", "image"],
    description: "Snap or upload meal photos for AI food analysis.",
    href: "/photo",
    icon: IconCamera,
  },
  {
    id: "dashboard",
    title: "Dashboard Home",
    category: "Pages & Settings",
    keywords: ["dashboard", "home", "stats", "streak", "calendar"],
    description: "Daily overview, calorie progress & streak calendar.",
    href: "/dashboard",
    icon: IconDashboard,
  },
];

export default function HeaderSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matchedCommands = useMemo(() => {
    if (!query.trim()) return APP_COMMANDS;
    const q = query.toLowerCase().trim();
    return APP_COMMANDS.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.keywords.some((kw) => kw.includes(q))
    );
  }, [query]);

  function handleNavigate(href: string) {
    setIsOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div className="relative">
      {/* Top Right Quick Search Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="active-press flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--ink-muted)] shadow-xs transition-all hover:border-[var(--leaf)] hover:text-[var(--foreground)]"
      >
        <IconSearch className="size-4 text-[var(--leaf)]" />
        <span className="hidden sm:inline">Search settings & pages...</span>
      </button>

      {/* Global Command Palette Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <IconSearch className="size-5 text-[var(--leaf)]" />
                <h3 className="text-base font-bold text-[var(--foreground)]">Global Navigation Search</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setQuery("");
                }}
                className="text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--foreground)]"
              >
                ✕ Close
              </button>
            </div>

            {/* Search Input */}
            <div className="space-y-4">
              <input
                type="text"
                className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 text-sm font-semibold outline-none focus:border-[var(--leaf)]"
                placeholder="Search settings (e.g. 'settings', 'history', 'theme', 'targets')..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />

              {/* Navigation & Settings Results */}
              {matchedCommands.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--ink-muted)]">
                  No matching settings or pages found for &quot;{query}&quot;.
                </p>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)] px-1">
                    App Pages & Settings Navigation ({matchedCommands.length})
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {matchedCommands.map((cmd) => {
                      const IconComponent = cmd.icon;
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          onClick={() => handleNavigate(cmd.href)}
                          className="active-press flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3 text-left transition-all hover:border-[var(--sky)] hover:bg-[var(--surface)]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] border border-[var(--line)] text-[var(--leaf)]">
                              <IconComponent className="size-4.5" />
                            </div>
                            <div>
                              <strong className="block text-xs font-bold text-[var(--foreground)]">{cmd.title}</strong>
                              <span className="text-[10px] text-[var(--ink-muted)] leading-tight line-clamp-1">
                                {cmd.description}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-[var(--sky)] font-bold">→</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
