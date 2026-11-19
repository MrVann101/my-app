"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/app-shell";
import LogFoodForm from "./log-food-form";
import TextFoodForm from "./text-food-form";
import Favorites from "./favorites";
import { IconLog, IconSparkles, IconStar } from "@/components/icons";

type LogTab = "search" | "text" | "favorites";

function LogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");
  const initialTab: LogTab =
    tabParam === "text" || tabParam === "favorites" || tabParam === "search" ? tabParam : "search";
  const activeTab = initialTab;

  function selectTab(tab: LogTab) {
    router.replace(`${pathname}?tab=${tab}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      {/* Segmented View Controller Tabs */}
      <nav
        aria-label="Input Method Tabs"
        className="flex rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xs"
      >
        {        [
          { id: "search", label: "Add Food Log", icon: IconLog },
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
              className={`active-press flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-[var(--leaf)] text-[var(--on-leaf)] shadow-xs"
                  : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <tab.icon aria-hidden="true" className="size-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Tab Content Panels */}
      {activeTab === "search" && (
        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7 shadow-xs">
          <div className="border-b border-[var(--line)] pb-4 mb-6">
            <h2 className="text-base font-bold text-[var(--foreground)]">Add Food Log</h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Enter any food item with automatic smart calorie estimates or custom nutrition values.
            </p>
          </div>
          <LogFoodForm />
        </div>
      )}

      {activeTab === "text" && (
        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7 shadow-xs">
          <div className="border-b border-[var(--line)] pb-4 mb-6">
            <h2 className="text-base font-bold text-[var(--foreground)]">Describe Your Meal</h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Type plain language (e.g. &quot;2 eggs and a slice of toast&quot;) for an AI estimate.
            </p>
          </div>
          <TextFoodForm />
        </div>
      )}

      {activeTab === "favorites" && (
        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7 shadow-xs">
          <div className="border-b border-[var(--line)] pb-4 mb-6">
            <h2 className="text-base font-bold text-[var(--foreground)]">Saved Favorites & Quick Log</h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Re-log frequent meals with a single tap.
            </p>
          </div>
          <Favorites />
        </div>
      )}
    </div>
  );
}

export default function LogPage() {
  return (
    <AppShell eyebrow="Food log" title="Add what you ate">
      <Suspense fallback={<div className="h-40 rounded-2xl bg-[var(--surface-muted)] animate-pulse" />}>
        <LogContent />
      </Suspense>
    </AppShell>
  );
}
