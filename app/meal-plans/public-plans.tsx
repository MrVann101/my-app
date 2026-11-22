"use client";

import { useEffect, useState } from "react";
import { IconBitewiseLogo, IconCheck, IconChevronRight, IconPlus, IconRefresh, IconSearch } from "@/components/icons";
import { isSafeMealPlanImageUrl } from "@/lib/image-security";
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

function getCreatorInitials(username: string) {
  const clean = username.replace(/^@/, "").replace(/[^a-zA-Z0-9]/g, "");
  if (!clean) return "BW";
  if (clean.length <= 2) return clean.toUpperCase();
  return (clean[0] + clean[clean.length - 1]).toUpperCase();
}

export default function PublicPlans({
  onSaved,
  onViewMyPlans,
}: {
  onSaved?: () => void;
  onViewMyPlans?: () => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [coverImages, setCoverImages] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
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
      try {
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
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saveCopy(id: number, planName: string) {
    setStatus(null);
    setError(null);
    setSavingId(id);
    try {
      const plan = plans.find((item) => item.id === id);
      const validGoal =
        plan?.goal === "lose" || plan?.goal === "maintain" || plan?.goal === "gain" ? plan.goal : null;
      const response = plan?.recipe
        ? await fetch("/api/meal-plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              visibility: "private",
              goal: validGoal,
              dietType: plan.diet_type ?? null,
              forkedFrom: id,
              recipe: plan.recipe,
            }),
          })
        : await fetch(`/api/meal-plans/${id}/fork`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to save this plan.");
        return;
      }

      let sourceCover: string | null = null;
      if (!plan?.recipe?.imageUrl) {
        try {
          sourceCover = coverImages[id] ?? localStorage.getItem(`bitewise_plan_cover_${id}`);
        } catch {}
      }
      const savedPlanId = Number(plan?.recipe ? payload.plan?.id : payload.planId);
      let coverCopyFailed = false;
      if (sourceCover && Number.isSafeInteger(savedPlanId) && savedPlanId > 0) {
        try {
          localStorage.setItem(`bitewise_plan_cover_${savedPlanId}`, sourceCover);
        } catch {
          coverCopyFailed = true;
        }
      }

      await load();
      onSaved?.();
      setStatus(
        coverCopyFailed
          ? `Saved "${planName}" to My Plans, though its cover image could not be copied.`
          : `Saved a private copy of "${planName}" to My Plans.`,
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this plan.");
    } finally {
      setSavingId(null);
    }
  }

  const filteredPlans = plans.filter((plan) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchName = plan.name.toLowerCase().includes(q);
    const matchCreator = (plan.creator_username || "").toLowerCase().includes(q);
    const matchFood = plan.meal_plan_items?.some((item) => item.food_name.toLowerCase().includes(q));
    const matchIngredients = plan.recipe?.ingredients?.some((ing) => ing.name.toLowerCase().includes(q));
    return Boolean(matchName || matchCreator || matchFood || matchIngredients);
  });

  return (
    <section className="space-y-4 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs sm:p-6">
      <div className="flex flex-col items-stretch justify-between gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="public-plans-search" className="sr-only">
              Search public meal plans
            </label>
            <input
              id="public-plans-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search public plans by title, @username, or ingredient..."
              className="h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] pl-9 pr-4 text-xs font-semibold placeholder:text-[var(--ink-muted)] outline-none transition-colors focus:border-[var(--leaf)] focus:bg-[var(--surface)]"
            />
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-muted)]" />
          </div>

          <button
            className="active-press grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] text-[var(--foreground)] transition-colors hover:border-[var(--leaf)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={() => void load()}
            type="button"
            title={isLoading ? "Refreshing public plans" : "Refresh public plans"}
            aria-label={isLoading ? "Refreshing public plans" : "Refresh public plans"}
          >
            <IconRefresh className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-[var(--coral-soft)] p-3 text-xs font-bold text-[var(--coral)]" role="alert">{error}</p>}

      {status && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--leaf-light)] p-3.5 text-xs font-bold text-[var(--leaf-ink)]" role="status">
          <span className="inline-flex items-center gap-1.5">
            <IconCheck className="size-4 shrink-0" />
            <span>{status}</span>
          </span>
          {onViewMyPlans && (
            <button
              type="button"
              onClick={onViewMyPlans}
              className="inline-flex min-h-9 items-center gap-1 underline underline-offset-2 hover:opacity-80"
            >
              <span>View in My Plans</span>
              <IconChevronRight className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {filteredPlans.length === 0 ? (
        <p className="py-6 text-center text-xs text-[var(--ink-muted)]">
          {isLoading ? "Loading public plans..." : searchQuery.trim() ? `No public plans found matching "${searchQuery}".` : "No public plans available right now."}
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 pt-1 lg:grid-cols-2">
          {filteredPlans.map((plan) => {
            const isBitewiseTeam =
              plan.creator_username === "Bitewise Team" ||
              plan.creator_username?.toLowerCase() === "bitewise_team";
            let creatorAvatar: string | null = null;
            if (!isBitewiseTeam) {
              try {
                creatorAvatar = typeof window !== "undefined" ? localStorage.getItem(`bitewise_avatar_${plan.creator_username}`) : null;
              } catch {}
            }
            const initials = getCreatorInitials(plan.creator_username || "");
            const nutrition = plan.recipe?.nutrition ?? {
              calories: Number(plan.total_calories),
              proteinG: plan.meal_plan_items.reduce((total, item) => total + Number(item.protein_g), 0),
              carbsG: plan.meal_plan_items.reduce((total, item) => total + Number(item.carbs_g), 0),
              fatG: plan.meal_plan_items.reduce((total, item) => total + Number(item.fat_g), 0),
            };

            const safeImageUrl = isSafeMealPlanImageUrl(plan.recipe?.imageUrl) ? plan.recipe?.imageUrl : null;
            const resolvedCover = safeImageUrl ?? coverImages[plan.id] ?? null;

            return (
              <div
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs transition-shadow hover:shadow-sm sm:p-5"
                key={plan.id}
              >
                {resolvedCover && (
                  <div className="-mx-4 -mt-4 mb-4 h-44 overflow-hidden border-b border-[var(--line)] sm:-mx-5 sm:-mt-5 sm:h-48">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolvedCover}
                      alt={plan.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div>
                  <h3 className="text-base font-bold text-[var(--foreground)]">{plan.name}</h3>
                  {plan.recipe && <p className="mt-1 line-clamp-2 text-sm text-[var(--ink-muted)]">{plan.recipe.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)]">
                    <div className="inline-flex items-center gap-1.5">
                      {isBitewiseTeam ? (
                        <>
                          <IconBitewiseLogo className="size-6 shrink-0" />
                          <span>
                            By <strong className="text-[var(--foreground)]">Bitewise Team</strong>
                          </span>
                          <span className="rounded-full bg-[var(--leaf-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--leaf-ink)]">
                            Official
                          </span>
                        </>
                      ) : (
                        <>
                          {creatorAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={creatorAvatar}
                              alt={plan.creator_username}
                              loading="lazy"
                              decoding="async"
                              className="size-6 rounded-full border border-[var(--line)] object-cover"
                            />
                          ) : (
                            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--leaf)] text-[10px] font-black text-[var(--on-leaf)]">
                              {initials}
                            </div>
                          )}
                          <span>By <strong>@{plan.creator_username}</strong></span>
                        </>
                      )}
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

                <div className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
                  {[
                    ["Calories", `${Math.round(nutrition.calories)} kcal`],
                    ["Protein", `${Math.round(nutrition.proteinG)}g`],
                    ["Carbs", `${Math.round(nutrition.carbsG)}g`],
                    ["Fat", `${Math.round(nutrition.fatG)}g`],
                  ].map(([label, value]) => (
                    <div className="rounded-xl bg-[var(--surface-muted)] p-2 text-center" key={label}>
                      <p className="truncate text-[10px] font-bold uppercase text-[var(--ink-muted)]">{label}</p>
                      <p className="tabular-nums mt-0.5 truncate text-xs font-bold text-[var(--foreground)]">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 border-t border-[var(--line)]/50 pt-2 text-xs text-[var(--ink-muted)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {plan.recipe
                        ? plan.recipe.manual
                          ? `${plan.recipe.ingredients.length} ingredients`
                          : `${plan.recipe.cookTimeMinutes} min · ${plan.recipe.servings} servings · ${plan.recipe.ingredients.length} ingredients`
                        : `${plan.meal_plan_items?.length ?? 0} food items included`}
                    </span>
                    {(plan.recipe || (plan.meal_plan_items?.length ?? 0) > 0) && (
                      <button
                        aria-controls={`public-plan-details-${plan.id}`}
                        aria-expanded={viewingPlanId === plan.id}
                        className="inline-flex min-h-11 items-center font-bold text-[var(--leaf-ink)] hover:underline"
                        onClick={() => setViewingPlanId((current) => (current === plan.id ? null : plan.id))}
                        type="button"
                      >
                        {viewingPlanId === plan.id ? "Hide details" : plan.recipe ? "View recipe" : "View items"}
                      </button>
                    )}
                  </div>

                  {viewingPlanId === plan.id && (
                    <div id={`public-plan-details-${plan.id}`} className="mt-3 space-y-4 text-sm">
                      {plan.recipe ? (
                        <>
                          <div>
                            <h4 className="font-bold text-[var(--foreground)]">Ingredients</h4>
                            <ul className="mt-2 space-y-1">
                              {plan.recipe.ingredients.map((ingredient, index) => (
                                <li key={`${ingredient.name}-${index}`}>{ingredient.name} — {ingredient.amount}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-bold text-[var(--foreground)]">How to cook it</h4>
                            <ol className="mt-2 list-inside list-decimal space-y-2 text-[var(--foreground)]">
                              {plan.recipe.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
                            </ol>
                          </div>
                        </>
                      ) : (
                        <ul className="space-y-1">
                          {plan.meal_plan_items.map((item, idx) => (
                            <li key={`${item.food_name}-${idx}`}>
                              {item.food_name} — {Math.round(Number(item.weight_g))}g
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-auto flex justify-end pt-4">
                  <button
                    className="active-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--leaf)] px-5 text-sm font-bold text-[var(--on-leaf)] shadow-2xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
                    disabled={savingId === plan.id}
                    onClick={() => void saveCopy(plan.id, plan.name)}
                    type="button"
                  >
                    <IconPlus className="size-4" />
                    <span>{savingId === plan.id ? "Saving..." : "Save Copy"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
