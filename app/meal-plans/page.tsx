"use client";

import { useState } from "react";
import AppShell from "@/components/app-shell";
import RecipeFinder from "./recipe-finder";
import MyPlans from "./my-plans";
import PlanBuilder from "./plan-builder";
import PublicPlans from "./public-plans";

type MealTab = "find-meals" | "public-plans" | "manual-plan" | "my-plans";

export default function MealPlansPage() {
  const [activeTab, setActiveTab] = useState<MealTab>("my-plans");
  const [postNotice, setPostNotice] = useState<{ message: string; isError: boolean } | null>(null);

  return (
    <AppShell eyebrow="Cook with what you have" title="Meal Plans">
      <div className="space-y-6">
        <nav aria-label="Meal navigation" className="inline-flex w-full max-w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xs sm:w-auto">
          {([
            ["my-plans", "My Plans"],
            ["find-meals", "Find Meals"],
            ["public-plans", "Public Plans"],
            ["manual-plan", "Manual Plan"],
          ] as const).map(([tab, label]) => (
            <button
              aria-current={activeTab === tab ? "page" : undefined}
              className={`min-w-0 flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-center text-xs font-bold transition-colors sm:flex-none sm:px-5 sm:text-sm ${
                activeTab === tab ? "bg-[var(--leaf)] text-[var(--on-leaf)] shadow-xs" : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)]"
              }`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
        {postNotice && (
          <p className={`text-sm font-bold ${postNotice.isError ? "text-[var(--coral)]" : "text-[var(--leaf-ink)]"}`} role={postNotice.isError ? "alert" : "status"}>
            {postNotice.message}
          </p>
        )}

        {activeTab === "find-meals" && <RecipeFinder />}
        {activeTab === "public-plans" && <PublicPlans onForked={() => setActiveTab("my-plans")} />}
        {activeTab === "manual-plan" && (
          <section className="mx-auto w-full max-w-4xl rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:p-7">
            <div className="mb-5 border-b border-[var(--line)] pb-4">
              <h2 className="text-lg font-bold text-[var(--foreground)]">Build a manual meal plan</h2>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                Add ingredients and cooking steps. AI will estimate the nutrition; you can add a serving to today&apos;s tracker from My Plans when you are ready.
              </p>
            </div>
            <PlanBuilder onPlanCreated={(visibility, message, isError) => {
              setPostNotice({ message, isError });
              setActiveTab(visibility === "public" ? "public-plans" : "my-plans");
            }} />
          </section>
        )}
        {activeTab === "my-plans" && <MyPlans />}
      </div>
    </AppShell>
  );
}
