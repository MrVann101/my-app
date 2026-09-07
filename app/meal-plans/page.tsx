"use client";

import { useState } from "react";
import AppShell from "@/components/app-shell";
import PlanBuilder from "./plan-builder";
import PublicPlans from "./public-plans";
import MyPlans from "./my-plans";
import { IconMealPlans, IconGlobe } from "@/components/icons";

type MealPlanTab = "my-plans" | "public-plans" | "create-plan";

export default function MealPlansPage() {
  const [activeTab, setActiveTab] = useState<MealPlanTab>("my-plans");

  return (
    <AppShell eyebrow="Meal plans" title="Plan ahead, lightly">
      <div className="space-y-6">
        {/* Navigation & Tab Switcher Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <nav
            aria-label="Meal Plan Navigation Tabs"
            className="flex justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xs w-full sm:w-auto"
          >
            <button
              type="button"
              onClick={() => setActiveTab("my-plans")}
              className={`active-press flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                activeTab === "my-plans"
                  ? "bg-[var(--leaf)] text-white shadow-xs"
                  : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <IconMealPlans className="size-4" />
              <span>My Saved Plans</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("public-plans")}
              className={`active-press flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                activeTab === "public-plans"
                  ? "bg-[var(--leaf)] text-white shadow-xs"
                  : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <IconGlobe className="size-4" />
              <span>Explore Public Plans</span>
            </button>
          </nav>

          <button
            type="button"
            onClick={() => setActiveTab("create-plan")}
            className={`active-press inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-xs ${
              activeTab === "create-plan"
                ? "bg-[var(--leaf-deep)] text-white ring-2 ring-[var(--leaf)]"
                : "bg-[var(--leaf)] text-white hover:bg-[var(--leaf-deep)]"
            }`}
          >
            <span>+ Create New Plan</span>
          </button>
        </div>

        {/* Tab 1: My Saved Plans */}
        {activeTab === "my-plans" && <MyPlans />}

        {/* Tab 2: Public Plans */}
        {activeTab === "public-plans" && (
          <PublicPlans onForked={() => setActiveTab("my-plans")} />
        )}

        {/* Tab 3: Create Plan Wizard */}
        {activeTab === "create-plan" && (
          <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
            <div className="border-b border-[var(--line)] pb-4 mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[var(--foreground)]">Create Meal Plan Template</h2>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  Creating or editing a plan template never changes today&apos;s totals until logged.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("my-plans")}
                className="text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--foreground)]"
              >
                ✕ Cancel
              </button>
            </div>
            <PlanBuilder onPlanCreated={() => setActiveTab("my-plans")} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
