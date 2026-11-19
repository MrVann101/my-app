"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/app-shell";
import LogFoodForm from "./log-food-form";
import TextFoodForm from "./text-food-form";
import Favorites from "./favorites";
import SavedMealsTab from "./saved-meals-tab";
import { IconLog, IconMealPlans, IconSparkles, IconStar } from "@/components/icons";

type LogTab = "search" | "saved" | "text" | "favorites";

function LogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");
  const initialTab: LogTab =
    tabParam === "saved" || tabParam === "text" || tabParam === "favorites" || tabParam === "search" ? tabParam : "search";
  const activeTab = initialTab;

  function selectTab(tab: LogTab) {
    router.replace(`${pathname}?tab=${tab}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      {/* Segmented View Controller Tabs */}
      <nav
        aria-label="Input Method Tabs"
        className="flex flex-wrap rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xs gap-1"
      >
        {[
          { id: "search", label: "Database & Custom", icon: IconLog },
          { id: "saved", label: "Saved Meals", icon: IconMealPlans },
          { id: "text", label: "Text AI", icon: IconSparkles },
          { id: "favorites", label: "Favorites", icon: IconStar },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => selectTab(tab.id as LogTab)}
              role="tab"
              aria-selected={isActive}
              className={`active-press flex min-h-11 flex-1 min-w-[120px] items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-[var(--leaf)] text-[var(--on-leaf)] shadow-xs"
                  : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <tab.icon aria-hidden="true" className="size-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Tab Content Panels */}
      {activeTab === "search" && (
        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7 shadow-xs">
          <LogFoodForm initialMealType={searchParams.get("meal") ?? undefined} />
        </div>
      )}

      {activeTab === "saved" && (
        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7 shadow-xs">
          <SavedMealsTab />
        </div>
      )}

      {activeTab === "text" && (
        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7 shadow-xs">
          <TextFoodForm />
        </div>
      )}

      {activeTab === "favorites" && (
        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7 shadow-xs">
          <Favorites />
        </div>
      )}
    </div>
  );
}

export default function LogPage() {
  return (
    <AppShell eyebrow="Daily Tracking" title="Quick Log">
      <Suspense fallback={<div className="h-40 rounded-2xl bg-[var(--surface-muted)] animate-pulse" />}>
        <LogContent />
      </Suspense>
    </AppShell>
  );
}
