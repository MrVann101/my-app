"use client";

import { useCallback, useEffect, useState } from "react";
import type { Recipe } from "@/lib/recipes";
import { IconLog } from "@/components/icons";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";

type SavedMeal = {
  id: number;
  name: string;
  total_calories: number;
  visibility: "private" | "public";
  is_favorite: boolean;
  favorited_at: string | null;
  recipe: Recipe | null;
  meal_plan_items: {
    id: number;
    meal_type: string;
    food_name: string;
    weight_g: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }[];
};

type PendingFavoriteAction = {
  meal: SavedMeal;
};

export default function MyPlans() {
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [coverImages, setCoverImages] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loggingId, setLoggingId] = useState<number | null>(null);
  const [updatingFavoriteId, setUpdatingFavoriteId] = useState<number | null>(null);
  const [pendingFavoriteAction, setPendingFavoriteAction] = useState<PendingFavoriteAction | null>(null);
  const [viewingMealId, setViewingMealId] = useState<number | null>(null);
  const [mealType, setMealType] = useState("snack");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadMeals = useCallback(async () => {
    setError(null);
    setStatus(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/meal-plans", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to load saved meals.");
      const savedMeals = payload.plans ?? [];
      setMeals(savedMeals);
      const images: Record<number, string> = {};
      for (const meal of savedMeals) {
        const coverImage = localStorage.getItem(`bitewise_plan_cover_${meal.id}`);
        if (coverImage) images[meal.id] = coverImage;
      }
      setCoverImages(images);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load saved meals.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMeals();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMeals]);

  async function deleteMeal(id: number) {
    setError(null);
    setStatus(null);
    setDeletingId(id);
    try {
      const response = await fetch(`/api/meal-plans/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to delete this meal.");
      setMeals((current) => current.filter((meal) => meal.id !== id));
      setViewingMealId((current) => current === id ? null : current);
      setStatus("Meal removed from My Plans.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this meal.");
    } finally {
      setDeletingId(null);
    }
  }

  function requestDeleteMeal(meal: SavedMeal) {
    if (meal.is_favorite) {
      setPendingFavoriteAction({ meal });
      return;
    }
    void deleteMeal(meal.id);
  }

  async function logMeal(meal: SavedMeal) {
    await logMealNow(meal);
  }

  async function logMealNow(meal: SavedMeal) {
    const recipe = meal.recipe;
    setError(null);
    setStatus(null);
    setLoggingId(meal.id);
    try {
      const logDate = getBrowserDate();
      const timezone = getBrowserTimezone();

      if (!recipe) {
        const response = await fetch(`/api/meal-plans/${meal.id}/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logDate, timezone, mealType }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Unable to log this meal plan.");
        setStatus(`Logged ${meal.name} to your journal. It remains in My Plans. Its calories are included in today's total.`);
        return;
      }

      const logResponse = await fetch("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate,
          timezone,
          mealType,
          foodName: recipe.title,
          weightG: 1,
          nutrientRate: {
            caloriesPerG: recipe.nutrition.calories,
            proteinPerG: recipe.nutrition.proteinG,
            carbsPerG: recipe.nutrition.carbsG,
            fatPerG: recipe.nutrition.fatG,
            fiberPerG: 0,
            sodiumPerG: 0,
            sugarPerG: 0,
          },
          source: "database",
          dataSource: null,
          aiConfidence: null,
          isRecipe: true,
        }),
      });
      const logPayload = await logResponse.json();
      if (!logResponse.ok) throw new Error(logPayload.error?.message ?? "Unable to log this recipe.");
      setStatus(`Logged ${recipe.title} as ${mealType} to your journal. It remains in My Plans. Its calories are included in today's total.`);
    } catch (logError) {
      setError(logError instanceof Error
        ? logError.message
        : "Unable to log this recipe.");
    } finally {
      setLoggingId(null);
    }
  }

  async function toggleFavorite(meal: SavedMeal) {
    setError(null);
    setStatus(null);
    setUpdatingFavoriteId(meal.id);
    const isFavorite = !meal.is_favorite;
    const favoritedAt = isFavorite ? new Date().toISOString() : null;
    setMeals((current) => current.map((item) => item.id === meal.id
      ? { ...item, is_favorite: isFavorite, favorited_at: favoritedAt }
      : item));
    try {
      const response = await fetch(`/api/meal-plans/${meal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to update favorite.");
      setMeals((current) => current.map((item) => item.id === meal.id
        ? { ...item, is_favorite: payload.plan.is_favorite, favorited_at: payload.plan.favorited_at }
        : item));
      setStatus(payload.plan.is_favorite ? "Recipe added to favorites." : "Recipe removed from favorites.");
    } catch (favoriteError) {
      setMeals((current) => current.map((item) => item.id === meal.id
        ? { ...item, is_favorite: meal.is_favorite, favorited_at: meal.favorited_at }
        : item));
      setError(favoriteError instanceof Error ? favoriteError.message : "Unable to update favorite.");
    } finally {
      setUpdatingFavoriteId(null);
    }
  }

  const orderedMeals = [
    ...meals.filter((meal) => meal.is_favorite),
    ...meals.filter((meal) => !meal.is_favorite),
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--foreground)]">My Plans</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Your private plans and meals you have shared publicly.</p>
        </div>
        <button className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50" disabled={isLoading} onClick={() => void loadMeals()} type="button">
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <p className="rounded-xl bg-[var(--coral)]/10 p-4 text-sm font-semibold text-[var(--coral)]" role="alert">{error}</p>}
      {status && <p className="rounded-xl bg-[var(--leaf-light)] p-4 text-sm font-semibold text-[var(--leaf-ink)]" role="status">{status}</p>}
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-[var(--ink-muted)]">
        Log saved recipes as
        <select
          aria-label="Meal event for saved meals"
          className="min-h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--foreground)]"
          value={mealType}
          onChange={(event) => setMealType(event.target.value)}
        >
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
      </label>

      {isLoading ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--ink-muted)]">Loading your meals...</p>
      ) : meals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center">
          <h3 className="font-bold text-[var(--foreground)]">No saved meals yet</h3>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">Find a meal using your ingredients or fork a public plan to save it here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {orderedMeals.map((meal) => {
            const recipe = meal.recipe;
            const title = recipe?.title ?? meal.name;
            const nutrition = recipe?.nutrition ?? {
              calories: Number(meal.total_calories),
              proteinG: meal.meal_plan_items.reduce((total, item) => total + Number(item.protein_g), 0),
              carbsG: meal.meal_plan_items.reduce((total, item) => total + Number(item.carbs_g), 0),
              fatG: meal.meal_plan_items.reduce((total, item) => total + Number(item.fat_g), 0),
            };
            return (
              <article
                className="relative flex flex-col w-full overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs transition hover:shadow-sm"
                key={meal.id}
              >
                {(recipe?.imageUrl || coverImages[meal.id]) && (
                  <div className="-mx-4 -mt-4 sm:-mx-5 sm:-mt-5 mb-4 h-44 sm:h-48 shrink-0 overflow-hidden border-b border-[var(--line)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={recipe?.imageUrl ?? coverImages[meal.id]}
                      alt={`${title} cover`}
                      className="block h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="pr-11">
                    <h3 className="line-clamp-1 text-base font-bold text-[var(--foreground)]">{title}</h3>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${meal.visibility === "public" ? "bg-[var(--leaf-light)] text-[var(--leaf-ink)]" : "bg-[var(--surface-muted)] text-[var(--ink-muted)]"}`}>
                      {meal.visibility === "public" ? "Public" : "Private"}
                    </span>
                    {!recipe?.manual && (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--ink-muted)]">{recipe?.description ?? `${meal.meal_plan_items.length} food items in this meal plan.`}</p>
                    )}
                  </div>
                </div>
                <button
                  aria-label={meal.is_favorite ? `Remove ${title} from favorites` : `Add ${title} to favorites`}
                  aria-pressed={meal.is_favorite}
                  className={`absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-[var(--surface)] shadow-sm transition-colors disabled:opacity-50 ${meal.is_favorite ? "text-amber-500 hover:bg-amber-500/10" : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-amber-500"}`}
                  disabled={updatingFavoriteId === meal.id}
                  onClick={() => void toggleFavorite(meal)}
                  type="button"
                >
                  <svg aria-hidden="true" className="size-5" fill={meal.is_favorite ? "currentColor" : "none"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
                  </svg>
                </button>
                <p className="mt-3 min-h-4 text-xs font-semibold text-[var(--leaf-ink)]">
                  {recipe?.manual
                    ? "Manual recipe"
                    : recipe ? `${recipe.cookTimeMinutes} min · ${recipe.servings} servings` : "\u00a0"}
                </p>
                {recipe?.manual && recipe.nutrition.calories <= 0 ? (
                  <p className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3 text-xs text-[var(--ink-muted)]">
                    Nutrition information wasn’t provided for this manual recipe.
                  </p>
                ) : (
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
                )}
                <div className="mt-4 border-t border-[var(--line)] pt-3">
                  <button
                    aria-expanded={viewingMealId === meal.id}
                    aria-controls={`meal-details-${meal.id}`}
                    className="cursor-pointer text-sm font-bold text-[var(--leaf-ink)]"
                    onClick={() => setViewingMealId((current) => current === meal.id ? null : meal.id)}
                    type="button"
                  >
                    {viewingMealId === meal.id ? "Hide details" : recipe ? "View recipe" : "View meal items"}
                  </button>
                  {viewingMealId === meal.id && (
                    <div
                      className="mt-3"
                      id={`meal-details-${meal.id}`}
                    >
                      {recipe ? (
                        <>
                          <h4 className="text-sm font-bold text-[var(--foreground)]">Ingredients</h4>
                          <ul className="mt-3 space-y-1 text-sm text-[var(--ink-muted)]">
                            {recipe.ingredients.map((ingredient, index) => (
                              <li key={`${ingredient.name}-${index}`}>{ingredient.name} — {ingredient.amount}</li>
                            ))}
                          </ul>
                          <h4 className="mt-5 text-sm font-bold text-[var(--foreground)]">Cooking steps</h4>
                          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm leading-5 text-[var(--foreground)]">
                            {recipe.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
                          </ol>
                        </>
                      ) : (
                        <>
                          <h4 className="text-sm font-bold text-[var(--foreground)]">Meal items</h4>
                          <ul className="mt-3 space-y-1 text-sm text-[var(--ink-muted)]">
                            {meal.meal_plan_items.map((item) => (
                              <li key={item.id}>{item.food_name} — {Math.round(Number(item.weight_g))} g ({Math.round(Number(item.calories))} kcal)</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--leaf)] px-4 text-sm font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={(recipe?.manual && recipe.nutrition.calories <= 0) || loggingId === meal.id || deletingId === meal.id}
                    onClick={() => void logMeal(meal)}
                    title={recipe?.manual && recipe.nutrition.calories <= 0 ? "Nutrition information is needed to log this recipe." : undefined}
                    type="button"
                  >
                    <IconLog aria-hidden="true" className="size-4" />
                    {loggingId === meal.id ? "Logging..." : "Log meal"}
                  </button>
                  <button
                    aria-label={`Remove ${title} from My Plans`}
                    title="Remove from My Plans"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--coral)]/30 text-[var(--coral)] hover:bg-[var(--coral)]/10 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={deletingId === meal.id || loggingId === meal.id}
                    onClick={() => requestDeleteMeal(meal)}
                    type="button"
                  >
                    <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
                    </svg>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {pendingFavoriteAction && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setPendingFavoriteAction(null)}>
          <section
            aria-labelledby="favorite-action-title"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="alertdialog"
          >
            <h2 className="text-lg font-bold text-[var(--foreground)]" id="favorite-action-title">
              Confirm removal
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              Are you sure you want to remove{" "}
              <strong className="text-[var(--foreground)]">{pendingFavoriteAction.meal.recipe?.title ?? pendingFavoriteAction.meal.name}</strong>?
              This will remove it from My Plans and Favorites.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="h-10 rounded-xl border border-[var(--line)] px-4 text-sm font-bold text-[var(--ink-muted)] hover:bg-[var(--surface-muted)]"
                onClick={() => setPendingFavoriteAction(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-10 rounded-xl bg-[var(--leaf)] px-4 text-sm font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)]"
                onClick={() => {
                  const pending = pendingFavoriteAction;
                  setPendingFavoriteAction(null);
                  void deleteMeal(pending.meal.id);
                }}
                type="button"
              >
                Remove meal
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
