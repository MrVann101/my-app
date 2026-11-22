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
  IconChevronRight,
  IconDashboard,
  IconLog,
  IconShoppingBag,
  IconUtensils,
  IconX,
} from "./icons";

type SearchGroupCategory = "Meal Plans & Recipes" | "Features & Tools" | "Pages & Settings";

type AppCommand = {
  id: string;
  title: string;
  category: SearchGroupCategory;
  keywords: string[];
  description: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

type SearchablePlanSummary = {
  id: number;
  name: string;
  total_calories: number;
  creator_username?: string;
  visibility?: "private" | "public";
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
    description: "Log meals from food database, custom foods, saved recipes, or favorites.",
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
    title: "My Meal Plans",
    category: "Features & Tools",
    keywords: ["meal plans", "my plans", "saved recipes", "my meals"],
    description: "View, photograph, or log your private saved meals and recipes.",
    href: "/meal-plans?tab=my-plans",
    icon: IconMealPlans,
  },
  {
    id: "cook-ingredients",
    title: "Cook with Ingredients",
    category: "Features & Tools",
    keywords: ["ingredients", "cook", "fridge", "pantry", "recipe finder", "meal ideas"],
    description: "Enter ingredients you have on hand to generate recipes.",
    href: "/meal-plans?tab=find-meals",
    icon: IconUtensils,
  },
  {
    id: "public-plans",
    title: "Public Meal Plans",
    category: "Features & Tools",
    keywords: ["public", "community", "official", "bitewise team", "discover", "browse"],
    description: "Explore official Bitewise Team and community meal plans.",
    href: "/meal-plans?tab=public-plans",
    icon: IconMealPlans,
  },
  {
    id: "create-recipe",
    title: "Create Recipe",
    category: "Features & Tools",
    keywords: ["create", "new recipe", "build meal", "manual", "custom recipe"],
    description: "Build a custom recipe with photo upload and nutrition estimation.",
    href: "/meal-plans?tab=manual-plan",
    icon: IconMealPlans,
  },
  {
    id: "weekly-plan",
    title: "Weekly Plan & Grocery List",
    category: "Features & Tools",
    keywords: ["weekly", "plan", "planner", "schedule", "grocery", "shopping list", "7 day"],
    description: "Manage your 7-day meal schedule, saved plans, and grocery checklist.",
    href: "/weekly-plan",
    icon: IconShoppingBag,
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

const CATEGORIES: SearchGroupCategory[] = [
  "Meal Plans & Recipes",
  "Features & Tools",
  "Pages & Settings",
];

export default function HeaderSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dynamicCommands, setDynamicCommands] = useState<AppCommand[]>([]);
  const hasLoadedPlansRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!isOpen || hasLoadedPlansRef.current) return;
    hasLoadedPlansRef.current = true;

    let active = true;
    void Promise.all([
      fetch("/api/meal-plans", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/meal-plans/public?limit=20", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([savedPayload, publicPayload]) => {
      if (!active) return;
      const items: AppCommand[] = [];
      const seenNames = new Set<string>();

      const savedPlans: SearchablePlanSummary[] = Array.isArray(savedPayload?.plans) ? savedPayload.plans : [];
      for (const plan of savedPlans) {
        if (!plan?.name) continue;
        const key = `saved:${plan.name.toLowerCase()}`;
        if (seenNames.has(key)) continue;
        seenNames.add(key);
        items.push({
          id: `saved-plan-${plan.id}`,
          title: plan.name,
          category: "Meal Plans & Recipes",
          keywords: [plan.name.toLowerCase(), "saved", "my plan", "recipe"],
          description: `Saved in My Plans · ${Math.round(Number(plan.total_calories) || 0)} kcal`,
          href: "/meal-plans?tab=my-plans",
          icon: IconMealPlans,
        });
      }

      const publicPlans: SearchablePlanSummary[] = Array.isArray(publicPayload?.plans) ? publicPayload.plans : [];
      for (const plan of publicPlans) {
        if (!plan?.name) continue;
        const key = `public:${plan.name.toLowerCase()}`;
        if (seenNames.has(key)) continue;
        seenNames.add(key);
        const author = plan.creator_username === "Bitewise Team" ? "Bitewise Team" : `@${plan.creator_username ?? "community"}`;
        items.push({
          id: `public-plan-${plan.id}`,
          title: plan.name,
          category: "Meal Plans & Recipes",
          keywords: [plan.name.toLowerCase(), author.toLowerCase(), "public", "recipe", "meal"],
          description: `Public Plan by ${author} · ${Math.round(Number(plan.total_calories) || 0)} kcal`,
          href: "/meal-plans?tab=public-plans",
          icon: IconCalendar,
        });
      }

      setDynamicCommands(items);
    });

    return () => {
      active = false;
    };
  }, [isOpen]);

  const orderedCommands = useMemo(() => {
    const q = query.toLowerCase().trim();
    const pool = q ? [...dynamicCommands, ...APP_COMMANDS] : APP_COMMANDS;
    const filtered = !q
      ? pool
      : pool.filter(
          (cmd) =>
            cmd.title.toLowerCase().includes(q) ||
            cmd.description.toLowerCase().includes(q) ||
            cmd.keywords.some((kw) => kw.includes(q)),
        );

    return CATEGORIES.flatMap((category) => filtered.filter((cmd) => cmd.category === category));
  }, [query, dynamicCommands]);

  const groupedCommands = useMemo(() => {
    return CATEGORIES.reduce<Array<{ category: SearchGroupCategory; items: AppCommand[]; startIndex: number }>>(
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
        setIsOpen((prev) => !prev);
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
        aria-label="Search pages, settings, and meal plans"
        className="active-press relative flex size-10 items-center justify-center gap-2 rounded-full border border-[var(--border-control)] bg-[var(--surface)] text-xs font-semibold text-[var(--ink-muted)] shadow-xs transition-colors after:absolute after:-inset-0.5 after:content-[''] hover:border-[var(--leaf)] hover:text-[var(--foreground)] sm:h-11 sm:w-auto sm:rounded-xl sm:px-3.5 sm:after:hidden"
      >
        <IconSearch className="size-4 shrink-0 text-[var(--leaf)]" />
        <span className="hidden sm:inline">Search</span>
      </button>

      <Dialog
        open={isOpen}
        onClose={handleClose}
        titleId="command-search-title"
        initialFocusRef={inputRef}
        maxWidthClass="max-w-xl"
        alignTop
        instant
        overflowHidden
      >
        <div className="shrink-0 space-y-3 border-b border-[var(--line)] pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <IconSearch className="size-4.5 text-[var(--leaf)]" />
              <h2 id="command-search-title" className="text-sm font-bold text-[var(--foreground)] sm:text-base">
                Quick Search
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close search"
              onClick={handleClose}
              className="active-press grid size-10 place-items-center rounded-xl text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            >
              <IconX className="size-4.5" />
            </button>
          </div>

          <div className="relative">
            <label htmlFor="global-command-search" className="sr-only">
              Search pages, meal plans, and settings
            </label>
            <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              id="global-command-search"
              type="text"
              ref={inputRef}
              className="h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] pl-10 pr-9 text-sm font-semibold outline-none transition-colors focus:border-[var(--leaf)]"
              placeholder="Search pages, public recipes, saved meals, or settings..."
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
            {query && (
              <button
                type="button"
                aria-label="Clear search query"
                onClick={() => {
                  setQuery("");
                  setSelectedIndex(0);
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              >
                <IconX className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 max-h-[54dvh] overflow-y-auto pr-1">
          {orderedCommands.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--ink-muted)]">
              No matching pages or meal plans found for &quot;{query}&quot;.
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
                              ? "border-[var(--leaf)] bg-[var(--leaf-light)]/60"
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
                          <IconChevronRight aria-hidden="true" className="size-4 shrink-0 text-[var(--leaf)]" />
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
