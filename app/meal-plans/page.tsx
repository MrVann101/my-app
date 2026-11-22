"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/app-shell";
import RecipeFinder from "./recipe-finder";
import MyPlans from "./my-plans";
import PlanBuilder from "./plan-builder";
import PublicPlans from "./public-plans";

type MealTab = "my-plans" | "find-meals" | "public-plans" | "manual-plan";

const MEAL_TABS: { id: MealTab; label: string }[] = [
  { id: "my-plans", label: "My Plans" },
  { id: "find-meals", label: "Cook with Ingredients" },
  { id: "public-plans", label: "Public Plans" },
  { id: "manual-plan", label: "Create Recipe" },
];

function MealPlansContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");
  const activeTab: MealTab =
    tabParam === "find-meals" || tabParam === "public-plans" || tabParam === "manual-plan" || tabParam === "my-plans"
      ? tabParam
      : "my-plans";

  const [postNotice, setPostNotice] = useState<{ message: string; isError: boolean } | null>(null);
  const [refreshMyPlansKey, setRefreshMyPlansKey] = useState(0);
  const [refreshPublicPlansKey, setRefreshPublicPlansKey] = useState(0);

  function selectTab(tab: MealTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="bg-[var(--background)]/95 pb-1">
        <div
          role="tablist"
          aria-label="Meal plans views"
          className="flex gap-1.5 overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xs sm:grid sm:grid-cols-4"
        >
          {MEAL_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`meal-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`meal-panel-${tab.id}`}
                onClick={() => selectTab(tab.id)}
                className={`active-press flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-4 text-xs font-bold transition-colors sm:px-2 sm:text-sm ${
                  isActive
                    ? "bg-[var(--leaf)] text-[var(--on-leaf)] shadow-xs"
                    : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {postNotice && (
        <p
          className={`rounded-xl p-4 text-sm font-bold ${
            postNotice.isError ? "bg-[var(--coral-soft)] text-[var(--coral)]" : "bg-[var(--leaf-light)] text-[var(--leaf-ink)]"
          }`}
          role={postNotice.isError ? "alert" : "status"}
        >
          {postNotice.message}
        </p>
      )}

      <div role="tabpanel" id="meal-panel-my-plans" aria-labelledby="meal-tab-my-plans" className={activeTab === "my-plans" ? "" : "hidden"}>
        <MyPlans
          key={refreshMyPlansKey}
          onPhotoChanged={() => setRefreshPublicPlansKey((k) => k + 1)}
          onExplorePublic={() => selectTab("public-plans")}
          onCookIngredients={() => selectTab("find-meals")}
        />
      </div>

      <div role="tabpanel" id="meal-panel-find-meals" aria-labelledby="meal-tab-find-meals" className={activeTab === "find-meals" ? "" : "hidden"}>
        <RecipeFinder onSaved={() => setRefreshMyPlansKey((k) => k + 1)} />
      </div>

      <div role="tabpanel" id="meal-panel-public-plans" aria-labelledby="meal-tab-public-plans" className={activeTab === "public-plans" ? "" : "hidden"}>
        <PublicPlans
          key={refreshPublicPlansKey}
          onSaved={() => setRefreshMyPlansKey((k) => k + 1)}
          onViewMyPlans={() => selectTab("my-plans")}
        />
      </div>

      <div role="tabpanel" id="meal-panel-manual-plan" aria-labelledby="meal-tab-manual-plan" className={activeTab === "manual-plan" ? "" : "hidden"}>
        <section className="mx-auto w-full max-w-4xl rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-7">
          <PlanBuilder
            onPlanCreated={(visibility, message, isError) => {
              setPostNotice({ message, isError });
              setRefreshMyPlansKey((k) => k + 1);
              setRefreshPublicPlansKey((k) => k + 1);
              selectTab(visibility === "public" ? "public-plans" : "my-plans");
            }}
          />
        </section>
      </div>
    </div>
  );
}

export default function MealPlansPage() {
  return (
    <AppShell eyebrow="Your nutrition" title="Meal Plans">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />}>
        <MealPlansContent />
      </Suspense>
    </AppShell>
  );
}
