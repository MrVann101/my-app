"use client";

import { useEffect, useState } from "react";
import { IconRefresh, IconFork } from "@/components/icons";
import type { Recipe } from "@/lib/recipes";

type Plan = {
  id: number;
  name: string;
  creator_username: string;
  goal: string | null;
  diet_type: string | null;
  total_calories: number;
  save_count: number;
  meal_plan_items: {
    food_name: string;
    weight_g: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }[];
  recipe: Recipe | null;
};

const CREATOR_GRADIENTS = [
  "from-[var(--sky)] to-[var(--leaf)]",
  "from-emerald-500 to-teal-700",
  "from-violet-500 to-purple-700",
  "from-amber-400 to-rose-600",
  "from-pink-500 to-rose-700",
  "from-indigo-500 to-cyan-600",
];

function getCreatorGradient(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash << 5) - hash + username.charCodeAt(i);
    hash |= 0;
  }
  return CREATOR_GRADIENTS[Math.abs(hash) % CREATOR_GRADIENTS.length];
}

function getCreatorInitials(username: string) {
  const clean = username.replace(/^@/, "").replace(/[^a-zA-Z0-9]/g, "");
  if (!clean) return "BW";
  if (clean.length <= 2) return clean.toUpperCase();
  return (clean[0] + clean[clean.length - 1]).toUpperCase();
}

export default function PublicPlans({ onForked }: { onForked?: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [coverImages, setCoverImages] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [forkingId, setForkingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingPlanId, setViewingPlanId] = useState<number | null>(null);

  async function load() {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/meal-plans/public?limit=20", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to load public plans.");
        return;
      }
      setPlans(payload.plans ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load public plans.");
    } finally {
      setIsLoading(false);
    }
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

  async function fork(id: number, planName: string) {
    setStatus(null);
    setError(null);
    setForkingId(id);
    try {
      const plan = plans.find((item) => item.id === id);
      const response = plan?.recipe
        ? await fetch("/api/meal-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visibility: "private", recipe: plan.recipe }),
        })
        : await fetch(`/api/meal-plans/${id}/fork`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to save this plan.");
        return;
      }

      const sourceCover = plan?.recipe?.imageUrl ? null : coverImages[id] ?? localStorage.getItem(`bitewise_plan_cover_${id}`);
      const forkedPlanId = Number(plan?.recipe ? payload.plan?.id : payload.planId);
      let coverCopyFailed = false;
      if (sourceCover && Number.isSafeInteger(forkedPlanId) && forkedPlanId > 0) {
        try {
          localStorage.setItem(`bitewise_plan_cover_${forkedPlanId}`, sourceCover);
        } catch {
          coverCopyFailed = true;
        }
      }

      await load();
      setStatus(coverCopyFailed
        ? `✓ Saved a private copy of "${planName}" to My Plans, but its cover image could not be copied. Your calorie tracker was not changed.`
        : `✓ Saved a private copy of "${planName}" to My Plans. Your calorie tracker was not changed.`);

      window.setTimeout(() => {
        onForked?.();
      }, 600);
    } catch (forkError) {
      setError(forkError instanceof Error ? forkError.message : "Unable to save this plan.");
    } finally {
      setForkingId(null);
    }
  }

  const filteredPlans = plans.filter((plan) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchName = plan.name.toLowerCase().includes(q);
    const matchCreator = (plan.creator_username || "").toLowerCase().includes(q);
    const matchFood = plan.meal_plan_items?.some((item) =>
      item.food_name.toLowerCase().includes(q)
    );
    return matchName || matchCreator || matchFood;
  });

  return (
    <section className="space-y-4 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6 shadow-xs">
      {/* Header Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search public plans by title, creator @username, or food..."
              className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] pl-9 pr-4 text-xs font-semibold placeholder:[var(--ink-muted)] outline-none focus:border-[var(--leaf)] focus:bg-[var(--surface)] transition-all"
            />
            <svg className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <button
            className="active-press grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={() => void load()}
            type="button"
            title={isLoading ? "Refreshing public plans" : "Refresh public plans"}
            aria-label={isLoading ? "Refreshing public plans" : "Refresh public plans"}
          >
            <IconRefresh aria-hidden="true" className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <p className="text-xs font-bold text-[var(--coral)]" role="alert">{error}</p>}
      {status && <p className="text-xs font-bold text-[var(--leaf)]" role="status">{status}</p>}

      <div className="space-y-3 pt-1">
        {filteredPlans.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--ink-muted)]">
            {isLoading ? "Loading public plans..." : searchQuery.trim() ? `No public plans found matching "${searchQuery}".` : "No public plans available right now."}
          </p>
        ) : (
          filteredPlans.map((plan) => {
            const creatorAvatar = typeof window !== "undefined"
              ? localStorage.getItem(`bitewise_avatar_${plan.creator_username}`)
              : null;
            const gradientClass = getCreatorGradient(plan.creator_username || "");
            const initials = getCreatorInitials(plan.creator_username || "");
            const nutrition = plan.recipe?.nutrition ?? {
              calories: Number(plan.total_calories),
              proteinG: plan.meal_plan_items.reduce((total, item) => total + Number(item.protein_g), 0),
              carbsG: plan.meal_plan_items.reduce((total, item) => total + Number(item.carbs_g), 0),
              fatG: plan.meal_plan_items.reduce((total, item) => total + Number(item.fat_g), 0),
            };

            return (
              <div
                className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs transition hover:shadow-sm"
                key={plan.id}
              >
                {(plan.recipe?.imageUrl || coverImages[plan.id]) && (
                  <div className="-mx-4 -mt-4 sm:-mx-5 sm:-mt-5 mb-4 overflow-hidden border-b border-[var(--line)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={plan.recipe?.imageUrl ?? coverImages[plan.id]}
                      alt={plan.name}
                      className="h-32 w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[var(--foreground)]">{plan.name}</h3>
                    {plan.recipe && <p className="mt-1 text-sm text-[var(--ink-muted)]">{plan.recipe.description}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)]">
                      <div className="inline-flex items-center gap-1.5">
                        {creatorAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={creatorAvatar}
                            alt={plan.creator_username}
                            className="size-5 rounded-full object-cover shadow-2xs border border-[var(--line)]"
                          />
                        ) : (
                          <div className={`flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientClass} text-[9px] font-black text-white shadow-2xs`}>
                            {initials}
                          </div>
                        )}
                        <span>By <strong>@{plan.creator_username}</strong></span>
                      </div>
                      {plan.recipe?.manual && (
                        <>
                          <span>·</span>
                          <span>Manual recipe</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{plan.save_count} saves</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
                  {[
                    ["Calories", `${Math.round(nutrition.calories)} kcal`],
                    ["Protein", `${Math.round(nutrition.proteinG)}g`],
                    ["Carbs", `${Math.round(nutrition.carbsG)}g`],
                    ["Fat", `${Math.round(nutrition.fatG)}g`],
                  ].map(([label, value]) => (
                    <div className="rounded-xl bg-[var(--surface-muted)] p-2 text-center" key={label}>
                      <p className="text-[10px] font-bold uppercase text-[var(--ink-muted)] truncate">{label}</p>
                      <p className="mt-0.5 text-xs font-bold tabular-nums text-[var(--foreground)] truncate">{value}</p>
                    </div>
                  ))}
                </div>

                {plan.recipe ? (
                  <div className="mt-3 border-t border-[var(--line)]/40 pt-2 text-xs text-[var(--ink-muted)]">
                    {plan.recipe.manual
                      ? `${plan.recipe.ingredients.length} ingredients`
                      : `${plan.recipe.cookTimeMinutes} min · ${plan.recipe.servings} servings · ${plan.recipe.ingredients.length} ingredients`}
                    <button
                      aria-controls={`public-recipe-${plan.id}`}
                      aria-expanded={viewingPlanId === plan.id}
                      className="ml-3 font-bold text-[var(--leaf-ink)]"
                      onClick={() => setViewingPlanId((current) => current === plan.id ? null : plan.id)}
                      type="button"
                    >
                      {viewingPlanId === plan.id ? "Hide recipe" : "View recipe"}
                    </button>
                    {viewingPlanId === plan.id && (
                      <div className="mt-4 space-y-4 text-sm">
                        <div>
                          <h4 className="font-bold text-[var(--foreground)]">Ingredients</h4>
                          <ul className="mt-2 space-y-1">
                            {plan.recipe.ingredients.map((ingredient, index) => (
                              <li key={`${ingredient.name}-${index}`}>{ingredient.name} — {ingredient.amount}</li>
                            ))}
                          </ul>
                        </div>
                        <div id={`public-recipe-${plan.id}`}>
                          <h4 className="font-bold text-[var(--foreground)]">How to cook it</h4>
                          <ol className="mt-2 list-inside list-decimal space-y-2 text-[var(--foreground)]">
                            {plan.recipe.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 border-t border-[var(--line)]/40 pt-2 text-xs text-[var(--ink-muted)]">
                    {plan.meal_plan_items?.length ?? 0} food items included in template
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    className="active-press inline-flex items-center gap-2 rounded-xl bg-[var(--leaf)] px-5 py-3 text-sm font-bold text-[var(--on-leaf)] shadow-2xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
                    disabled={forkingId === plan.id}
                    onClick={() => void fork(plan.id, plan.name)}
                    type="button"
                    title="Fork template to My Plans"
                  >
                    <IconFork className="size-4" />
                    <span>{forkingId === plan.id ? "Forking..." : "Fork"}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
