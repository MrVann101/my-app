"use client";

import { useEffect, useState } from "react";
import { IconMealPlans, IconSparkles, IconCheck, IconRefresh } from "@/components/icons";

type Item = { id: number; food_name: string; weight_g: number; calories: number; meal_type: string };
type Plan = { id: number; name: string; visibility: string; total_calories: number; goal: string | null; diet_type: string | null; meal_plan_items: Item[] };
type Recipe = { title: string; cookTimeMinutes: number; ingredients: { name: string; amount: string }[]; steps: string[] };

export default function MyPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [recipes, setRecipes] = useState<Record<number, Recipe>>({});
  const [loadingRecipe, setLoadingRecipe] = useState<number | null>(null);
  const [coverImages, setCoverImages] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/meal-plans");
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to load plans.");
      return;
    }
    setPlans(payload.plans ?? []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
      if (typeof window !== "undefined") {
        const map: Record<number, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("bitewise_plan_cover_")) {
            const planId = Number(key.replace("bitewise_plan_cover_", ""));
            if (!isNaN(planId)) {
              const val = localStorage.getItem(key);
              if (val) map[planId] = val;
            }
          }
        }
        setCoverImages(map);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function logToday(id: number) {
    setError(null);
    setStatus(null);
    const response = await fetch(`/api/meal-plans/${id}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logDate: new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to log this plan.");
      return;
    }
    setStatus(`✓ Added ${payload.logs.length} items from plan to today's journal.`);
  }

  async function generateRecipe(id: number) {
    setError(null);
    setLoadingRecipe(id);
    const response = await fetch(`/api/meal-plans/${id}/recipe`, { method: "POST" });
    const payload = await response.json();
    setLoadingRecipe(null);
    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to generate recipe.");
      return;
    }
    setRecipes((current) => ({ ...current, [id]: payload.recipe }));
  }

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs">
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
          Saved Templates ({plans.length})
        </span>
        <button
          className="active-press inline-flex items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-2 text-[var(--ink-muted)] hover:bg-[var(--line)] hover:text-[var(--foreground)]"
          onClick={() => void load()}
          type="button"
          title="Refresh plans"
          aria-label="Refresh plans"
        >
          <IconRefresh className="size-4" />
        </button>
      </div>

      {error && <p className="mt-4 text-xs font-bold text-[var(--coral)]" role="alert">{error}</p>}
      {status && <p className="mt-4 text-xs font-bold text-[var(--leaf)]" role="status">{status}</p>}

      <div className="mt-5 space-y-4">
        {plans.length === 0 ? (
          <p className="text-xs text-[var(--ink-muted)]">No saved meal plans yet. Create your first plan above!</p>
        ) : (
          plans.map((plan) => (
            <article
              className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-5 shadow-xs transition-shadow hover:shadow-sm"
              key={plan.id}
            >
              {coverImages[plan.id] && (
                <div className="-mx-5 -mt-5 mb-4 overflow-hidden border-b border-[var(--line)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverImages[plan.id]}
                    alt={plan.name}
                    className="h-32 w-full object-cover"
                  />
                </div>
              )}
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-base font-bold text-[var(--foreground)]">{plan.name}</h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[var(--ink-muted)]">
                    <span className="tabular-nums font-bold text-[var(--leaf)]">
                      {Math.round(Number(plan.total_calories))} kcal
                    </span>
                    <span>·</span>
                    <span className="capitalize font-semibold">{plan.visibility}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    className="active-press flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-[var(--leaf)] shadow-2xs hover:bg-[var(--surface-muted)]"
                    onClick={() => void generateRecipe(plan.id)}
                    type="button"
                  >
                    <IconSparkles className="size-3.5" />
                    <span>{loadingRecipe === plan.id ? "Generating..." : "Recipe"}</span>
                  </button>
                  <button
                    className="active-press flex items-center gap-1.5 rounded-xl bg-[var(--leaf)] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--leaf-deep)]"
                    onClick={() => void logToday(plan.id)}
                    type="button"
                  >
                    <IconCheck className="size-3.5" />
                    <span>Log to Today</span>
                  </button>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="mt-4 divide-y divide-[var(--line)]/40 border-t border-[var(--line)]/50 pt-3">
                {(plan.meal_plan_items ?? []).map((item) => (
                  <div className="flex justify-between py-1.5 text-xs" key={item.id}>
                    <span className="font-semibold text-[var(--foreground)]">
                      {item.food_name} <span className="font-normal text-[var(--ink-muted)]">· {item.weight_g}g</span>
                    </span>
                    <span className="tabular-nums font-bold text-[var(--ink-muted)]">
                      {Math.round(Number(item.calories))} kcal
                    </span>
                  </div>
                ))}
              </div>

              {/* Generated Recipe Dropdown */}
              {recipes[plan.id] && (
                <div className="mt-4 rounded-xl border border-[var(--leaf)]/30 bg-[var(--surface)] p-4 text-xs">
                  <p className="font-bold text-[var(--foreground)]">
                    📖 {recipes[plan.id].title} ({recipes[plan.id].cookTimeMinutes} min cook)
                  </p>

                  <p className="mt-3 font-bold uppercase tracking-wider text-[var(--leaf)]">Ingredients</p>
                  <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[var(--ink-muted)]">
                    {recipes[plan.id].ingredients.map((ingredient) => (
                      <li key={ingredient.name}>
                        {ingredient.name} — {ingredient.amount}
                      </li>
                    ))}
                  </ul>

                  <p className="mt-3 font-bold uppercase tracking-wider text-[var(--leaf)]">Steps</p>
                  <ol className="mt-1 list-decimal pl-4 space-y-1 text-[var(--foreground)]">
                    {recipes[plan.id].steps.map((step, index) => (
                      <li key={`${step}-${index}`}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
