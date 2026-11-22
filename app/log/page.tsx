"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/app-shell";
import LogFoodForm from "./log-food-form";
import PhotoFoodForm from "./photo-food-form";
import Favorites from "./favorites";
import SavedMealsTab from "./saved-meals-tab";
import { IconCamera, IconMealPlans, IconSearch, IconStar } from "@/components/icons";

type LogTab = "search" | "photo" | "saved" | "favorites";

const LOG_TABS: { id: LogTab; label: string; mobileLabel: string; icon: typeof IconSearch }[] = [
  { id: "search", label: "Search & Custom", mobileLabel: "Search", icon: IconSearch },
  { id: "photo", label: "Photo AI", mobileLabel: "Photo", icon: IconCamera },
  { id: "saved", label: "Saved Meals", mobileLabel: "Saved", icon: IconMealPlans },
  { id: "favorites", label: "Favorites", mobileLabel: "Favs", icon: IconStar },
];

function LogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");
  const mealParam = searchParams.get("meal") ?? undefined;

  const activeTab: LogTab =
    tabParam === "photo" || tabParam === "saved" || tabParam === "favorites" || tabParam === "search"
      ? tabParam
      : "search";

  function selectTab(tab: LogTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Food logging methods"
        className="grid grid-cols-4 gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xs"
      >
        {LOG_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`log-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`log-panel-${tab.id}`}
              onClick={() => selectTab(tab.id)}
              className={`active-press flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-semibold transition-colors sm:min-h-11 sm:flex-row sm:gap-2 sm:px-3 sm:text-xs md:text-sm ${
                isActive
                  ? "bg-[var(--leaf)] text-[var(--on-leaf)] shadow-xs"
                  : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <tab.icon className="size-4 shrink-0" />
              <span className="sm:hidden">{tab.mobileLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="log-panel-search"
        aria-labelledby="log-tab-search"
        className={activeTab === "search" ? "rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs sm:p-7" : "hidden"}
      >
        <LogFoodForm initialMealType={mealParam} />
      </div>

      <div
        role="tabpanel"
        id="log-panel-photo"
        aria-labelledby="log-tab-photo"
        className={activeTab === "photo" ? "rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs sm:p-7" : "hidden"}
      >
        <PhotoFoodForm initialMealType={mealParam} />
      </div>

      <div
        role="tabpanel"
        id="log-panel-saved"
        aria-labelledby="log-tab-saved"
        className={activeTab === "saved" ? "rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs sm:p-7" : "hidden"}
      >
        <SavedMealsTab initialMealType={mealParam} />
      </div>

      <div
        role="tabpanel"
        id="log-panel-favorites"
        aria-labelledby="log-tab-favorites"
        className={activeTab === "favorites" ? "rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs sm:p-7" : "hidden"}
      >
        <Favorites initialMealType={mealParam} />
      </div>
    </div>
  );
}

export default function LogPage() {
  return (
    <AppShell eyebrow="Daily Tracking" title="Quick Log">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />}>
        <LogContent />
      </Suspense>
    </AppShell>
  );
}
