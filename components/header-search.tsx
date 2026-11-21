"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import Dialog from "./dialog";
import {
  IconSearch,
  IconProfile,
  IconPalette,
  IconHistory,
  IconCalendar,
  IconTrendingUp,
  IconScale,
  IconZap,
  IconBell,
  IconShieldCheck,
  IconMealPlans,
  IconSparkles,
  IconCamera,
  IconDashboard,
  IconLog,
  IconX,
} from "./icons";

type AppCommand = {
  id: string;
  title: string;
  category: "Features & Tools" | "Pages & Settings";
  keywords: string[];
  description: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const APP_COMMANDS: AppCommand[] = [
  {
    id: "dashboard",
    title: "Today's Dashboard",
    category: "Pages & Settings",
    keywords: ["dashboard", "home", "today", "stats", "streak", "calendar"],
    description: "Daily overview, calorie progress, macros & today's meals.",
    href: "/dashboard",
    icon: IconDashboard,
  },
  {
    id: "log",
    title: "Quick Log",
    category: "Features & Tools",
    keywords: ["quick", "log", "food", "meal", "track", "add", "fast", "search"],
    description: "Log meals from food database, saved recipes, text, or favorites.",
    href: "/log",
    icon: IconLog,
  },
  {
    id: "photo-ai",
    title: "Photo AI Scanner",
    category: "Features & Tools",
    keywords: ["photo", "camera", "scan", "analyze photo", "image"],
    description: "Snap or upload meal photos for AI food analysis.",
    href: "/log?tab=photo",
    icon: IconCamera,
  },
  {
    id: "meal-plans",
    title: "Meal Plans & Recipes",
    category: "Features & Tools",
    keywords: ["meal plans", "ingredients", "recipes", "cook", "my meals", "meal ideas"],
    description: "Cook with ingredients you have, browse public plans, or save meals.",
    href: "/meal-plans",
    icon: IconMealPlans,
  },
  {
    id: "weekly-plan",
    title: "Weekly Plan",
    category: "Features & Tools",
    keywords: ["weekly", "plan", "planner", "schedule"],
    description: "Plan meals across the next seven days.",
    href: "/weekly-plan",
    icon: IconCalendar,
  },
  {
    id: "suggestions",
    title: "AI Meal Suggestions",
    category: "Features & Tools",
    keywords: ["ai suggestions", "ai meals", "ideas", "recommendations", "suggestions"],
    description: "Smart AI meal suggestions tailored to your remaining macros.",
    href: "/suggestions",
    icon: IconSparkles,
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
    id: "progress",
    title: "Analytics & Progress",
    category: "Pages & Settings",
    keywords: ["analytics", "progress", "weight", "weigh-in", "calories", "charts"],
    description: "Review nutrition trends, weight check-ins, and progress over time.",
    href: "/profile/progress",
    icon: IconTrendingUp,
  },
  {
    id: "history",
    title: "Meal & Log History",
    category: "Pages & Settings",
    keywords: ["history", "past logs", "30 days", "logs", "food history", "journal"],
    description: "Review past 30 days of logged meals and entries.",
    href: "/history",
    icon: IconHistory,
  },
  {
    id: "profile",
    title: "Settings & Profile Hub",
    category: "Pages & Settings",
    keywords: ["settings", "profile", "account", "preferences", "hub"],
    description: "Main settings & profile navigation hub.",
    href: "/profile",
    icon: IconProfile,
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
    id: "appearance",
    title: "Appearance & Theme",
    category: "Pages & Settings",
    keywords: ["appearance", "theme", "dark mode", "light mode", "color", "display"],
    description: "Switch between Warm Nordic Dark and Light modes.",
    href: "/profile/appearance",
    icon: IconPalette,
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
];

const CATEGORIES: AppCommand["category"][] = ["Features & Tools", "Pages & Settings"];

export default function HeaderSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const orderedCommands = useMemo(() => {
    const q = query.toLowerCase().trim();
    const filtered = !q
      ? APP_COMMANDS
      : APP_COMMANDS.filter(
          (cmd) =>
            cmd.title.toLowerCase().includes(q) ||
            cmd.description.toLowerCase().includes(q) ||
            cmd.keywords.some((kw) => kw.includes(q)),
        );

    return CATEGORIES.flatMap((category) => filtered.filter((cmd) => cmd.category === category));
  }, [query]);

  const groupedCommands = useMemo(() => {
    return CATEGORIES.reduce<Array<{ category: AppCommand["category"]; items: AppCommand[]; startIndex: number }>>(
      (groups, category) => {
        const items = orderedCommands.filter((cmd) => cmd.category === category);
        if (items.length === 0) return groups;
        const last = groups[groups.length - 1];
        const startIndex = last ? last.startIndex + last.items.length : 0;
        return [...groups, { category, items, startIndex }];
      },
      [],
    );
  }, [orderedCommands]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSelectedIndex(0);
        setIsOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [isOpen, selectedIndex]);

  function handleClose() {
    setIsOpen(false);
    setQuery("");
  }

  function handleNavigate(href: string) {
    setIsOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setSelectedIndex(0);
          setIsOpen(true);
        }}
        aria-label="Open navigation search"
        className="active-press flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--ink-muted)] shadow-xs transition-colors hover:border-[var(--leaf)] hover:text-[var(--foreground)]"
      >
        <IconSearch className="size-4 text-[var(--leaf)]" />
        <span className="hidden sm:inline">Search pages...</span>
      </button>

      <Dialog
        open={isOpen}
        onClose={handleClose}
        titleId="command-search-title"
        initialFocusRef={inputRef}
        maxWidthClass="max-w-xl"
        alignTop
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div className="flex items-center gap-2">
            <IconSearch className="size-5 text-[var(--leaf)]" />
            <h2 id="command-search-title" className="text-base font-bold text-[var(--foreground)]">
              Navigation Search
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close navigation search"
            onClick={handleClose}
            className="active-press inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl px-3 text-xs font-bold text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          >
            <IconX className="size-4" />
            <span>Close</span>
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="global-command-search" className="sr-only">
              Search pages and settings
            </label>
            <input
              id="global-command-search"
              type="text"
              ref={inputRef}
              className="h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-4 text-sm font-semibold outline-none focus:border-[var(--leaf)]"
              placeholder="Jump to a page or setting (e.g. 'progress', 'photo', 'theme')..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setSelectedIndex((index) => Math.min(index + 1, Math.max(0, orderedCommands.length - 1)));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setSelectedIndex((index) => Math.max(index - 1, 0));
                } else if (event.key === "Enter" && orderedCommands[selectedIndex]) {
                  event.preventDefault();
                  handleNavigate(orderedCommands[selectedIndex].href);
                }
              }}
            />
          </div>

          {orderedCommands.length === 0 ? (
            <p className="py-6 text-center text-xs text-[var(--ink-muted)]">
              No matching pages or settings found for &quot;{query}&quot;.
            </p>
          ) : (
            <div className="space-y-4">
              {groupedCommands.map((group) => (
                <div key={group.category} className="space-y-1.5">
                  <h3 className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                    {group.category} ({group.items.length})
                  </h3>
                  <div className="space-y-1.5">
                    {group.items.map((cmd, itemIdx) => {
                      const flatIndex = group.startIndex + itemIdx;
                      const IconComponent = cmd.icon;
                      const isSelected = selectedIndex === flatIndex;
                      return (
                        <button
                          key={cmd.id}
                          ref={(el) => {
                            itemRefs.current[flatIndex] = el;
                          }}
                          type="button"
                          onClick={() => handleNavigate(cmd.href)}
                          className={`active-press flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${
                            isSelected
                              ? "border-[var(--leaf)] bg-[var(--leaf-light)]/50"
                              : "border-[var(--line)] bg-[var(--surface-muted)] hover:border-[var(--leaf)] hover:bg-[var(--surface)]"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--leaf)]">
                              <IconComponent className="size-4.5" />
                            </div>
                            <div className="min-w-0">
                              <strong className="block truncate text-xs font-bold text-[var(--foreground)]">{cmd.title}</strong>
                              <span className="line-clamp-1 text-[11px] leading-tight text-[var(--ink-muted)]">
                                {cmd.description}
                              </span>
                            </div>
                          </div>
                          <span aria-hidden="true" className="shrink-0 text-xs font-bold text-[var(--leaf)]">→</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
