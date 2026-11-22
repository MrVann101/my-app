"use client";

import { useCallback, useEffect, useState } from "react";
import Dialog from "@/components/dialog";
import { removeUploadedMealPlanPhoto, uploadMealPlanPhoto } from "@/lib/client-image";
import { isSafeMealPlanImageUrl } from "@/lib/image-security";
import type { Recipe } from "@/lib/recipes";
import { IconCamera, IconLog, IconMealPlans, IconRefresh, IconStar, IconTrash } from "@/components/icons";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";
import { defaultMealTypeByHour, MEAL_SLOTS, type MealSlot } from "@/lib/meal-slot";

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

export default function MyPlans({
  onPhotoChanged,
  onExplorePublic,
  onCookIngredients,
}: {
  onPhotoChanged?: () => void;
  onExplorePublic?: () => void;
  onCookIngredients?: () => void;
} = {}) {
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [coverImages, setCoverImages] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loggingId, setLoggingId] = useState<number | null>(null);
  const [uploadingPhotoId, setUploadingPhotoId] = useState<number | null>(null);
  const [updatingFavoriteId, setUpdatingFavoriteId] = useState<number | null>(null);
  const [pendingDeleteMeal, setPendingDeleteMeal] = useState<SavedMeal | null>(null);
  const [viewingMealId, setViewingMealId] = useState<number | null>(null);
  const [mealType, setMealType] = useState<MealSlot>("snack");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMealType(defaultMealTypeByHour());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
        try {
          const coverImage = localStorage.getItem(`bitewise_plan_cover_${meal.id}`);
          if (coverImage) images[meal.id] = coverImage;
        } catch {}
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
      setViewingMealId((current) => (current === id ? null : current));
      setStatus("Meal removed from My Plans.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this meal.");
    } finally {
      setDeletingId(null);
    }
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
        setStatus(`Logged ${meal.name} to your journal. It remains in My Plans.`);
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
      setStatus(`Logged ${recipe.title} as ${mealType} to your journal. It remains in My Plans.`);
    } catch (logError) {
      setError(logError instanceof Error ? logError.message : "Unable to log this recipe.");
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
    setMeals((current) =>
      current.map((item) => (item.id === meal.id ? { ...item, is_favorite: isFavorite, favorited_at: favoritedAt } : item)),
    );
    try {
      const response = await fetch(`/api/meal-plans/${meal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to update favorite.");
      setMeals((current) =>
        current.map((item) =>
          item.id === meal.id
            ? { ...item, is_favorite: payload.plan.is_favorite, favorited_at: payload.plan.favorited_at }
            : item,
        ),
      );
      setStatus(payload.plan.is_favorite ? "Recipe added to favorites." : "Recipe removed from favorites.");
    } catch (favoriteError) {
      setMeals((current) =>
        current.map((item) =>
          item.id === meal.id ? { ...item, is_favorite: meal.is_favorite, favorited_at: meal.favorited_at } : item,
        ),
      );
      setError(favoriteError instanceof Error ? favoriteError.message : "Unable to update favorite.");
    } finally {
      setUpdatingFavoriteId(null);
    }
  }

  async function updateMealPhoto(meal: SavedMeal, file: File | undefined) {
    if (!file) return;
    setError(null);
    setStatus(null);
    setUploadingPhotoId(meal.id);
    let uploadedPath: string | null = null;

    try {
      const uploaded = await uploadMealPlanPhoto(file);
      uploadedPath = uploaded.path;

      const nextRecipe: Recipe = meal.recipe
        ? { ...meal.recipe, imageUrl: uploaded.imageUrl }
        : {
            title: meal.name,
            description:
              meal.meal_plan_items.length > 0
                ? `${meal.meal_plan_items.length} food items in this meal plan.`
                : "Saved meal plan.",
            cookTimeMinutes: 15,
            servings: 1,
            nutrition: {
              calories: Math.max(0, Math.round(Number(meal.total_calories))),
              proteinG: Math.max(0, Math.round(meal.meal_plan_items.reduce((total, item) => total + Number(item.protein_g), 0))),
              carbsG: Math.max(0, Math.round(meal.meal_plan_items.reduce((total, item) => total + Number(item.carbs_g), 0))),
              fatG: Math.max(0, Math.round(meal.meal_plan_items.reduce((total, item) => total + Number(item.fat_g), 0))),
            },
            ingredients:
              meal.meal_plan_items.length > 0
                ? meal.meal_plan_items.map((item) => ({
                    name: item.food_name,
                    amount: `${Math.round(Number(item.weight_g))}g`,
                    pantryStaple: false,
                  }))
                : [{ name: meal.name, amount: "1 serving", pantryStaple: false }],
            steps: ["Prepare and serve according to your meal plan."],
            imageUrl: uploaded.imageUrl,
          };

      const response = await fetch(`/api/meal-plans/${meal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe: nextRecipe }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Unable to save meal photo.");
      }

      uploadedPath = null;
      setMeals((current) =>
        current.map((item) => (item.id === meal.id ? { ...item, recipe: payload.plan?.recipe ?? nextRecipe } : item)),
      );
      onPhotoChanged?.();
      setStatus("Meal photo updated.");
    } catch (photoError) {
      if (uploadedPath) {
        await removeUploadedMealPlanPhoto(uploadedPath);
      }
      setError(photoError instanceof Error ? photoError.message : "Unable to update meal photo.");
    } finally {
      setUploadingPhotoId(null);
    }
  }

  const orderedMeals = [
    ...meals.filter((meal) => meal.is_favorite),
    ...meals.filter((meal) => !meal.is_favorite),
  ];

  return (
    <section className="space-y-4">
      {error && <p className="rounded-xl bg-[var(--coral-soft)] p-4 text-sm font-semibold text-[var(--coral)]" role="alert">{error}</p>}
      {status && <p className="rounded-xl bg-[var(--leaf-light)] p-4 text-sm font-semibold text-[var(--leaf-ink)]" role="status">{status}</p>}

      {meals.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="tabular-nums rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--ink-muted)]">
              {meals.length} saved
            </span>
            <label className="text-xs font-semibold text-[var(--ink-muted)] sm:text-sm" htmlFor="my-plans-meal-slot">
              Log as
            </label>
            <select
              id="my-plans-meal-slot"
              className="min-h-10 rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] px-3 text-xs font-bold text-[var(--foreground)] outline-none transition-colors focus:border-[var(--leaf)] focus:bg-[var(--surface)] sm:text-sm"
              value={mealType}
              onChange={(event) => setMealType(event.target.value as MealSlot)}
            >
              {MEAL_SLOTS.map((slot) => (
                <option key={slot.value} value={slot.value}>{slot.label}</option>
              ))}
            </select>
          </div>

          <button
            className="active-press grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] text-[var(--foreground)] transition-colors hover:border-[var(--leaf)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={() => void loadMeals()}
            type="button"
            title={isLoading ? "Refreshing saved meals" : "Refresh saved meals"}
            aria-label={isLoading ? "Refreshing saved meals" : "Refresh saved meals"}
          >
            <IconRefresh className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2 animate-pulse">
          <div className="h-52 rounded-2xl bg-[var(--surface-muted)]" />
          <div className="h-52 rounded-2xl bg-[var(--surface-muted)]" />
        </div>
      ) : meals.length === 0 ? (
        <div className="mx-auto max-w-xl rounded-[2rem] border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-2xs sm:p-10">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--leaf-light)] text-[var(--leaf)]">
            <IconMealPlans className="size-6" />
          </div>
          <h2 className="mt-4 text-lg font-bold tracking-tight text-[var(--foreground)]">No saved meals yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-[var(--ink-muted)]">
            Save a copy of an official Bitewise Team meal plan or generate a recipe from ingredients in your kitchen.
          </p>
          {(onExplorePublic || onCookIngredients) && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              {onExplorePublic && (
                <button
                  type="button"
                  onClick={onExplorePublic}
                  className="active-press min-h-11 rounded-xl bg-[var(--leaf)] px-5 text-sm font-bold text-[var(--on-leaf)] shadow-2xs hover:bg-[var(--leaf-deep)]"
                >
                  Browse Public Plans
                </button>
              )}
              {onCookIngredients && (
                <button
                  type="button"
                  onClick={onCookIngredients}
                  className="active-press min-h-11 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-5 text-sm font-bold text-[var(--foreground)] hover:border-[var(--leaf)] hover:bg-[var(--surface-muted)]"
                >
                  Cook with Ingredients
                </button>
              )}
            </div>
          )}
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
            const safeImageUrl = isSafeMealPlanImageUrl(recipe?.imageUrl) ? recipe?.imageUrl : null;
            const resolvedCover = safeImageUrl ?? coverImages[meal.id] ?? null;
            return (
              <article
                className="relative flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs transition-shadow hover:shadow-sm sm:p-5"
                key={meal.id}
              >
                {resolvedCover && (
                  <div className="relative -mx-4 -mt-4 mb-4 h-44 shrink-0 overflow-hidden border-b border-[var(--line)] sm:-mx-5 sm:-mt-5 sm:h-48">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolvedCover}
                      alt={`${title} cover`}
                      loading="lazy"
                      decoding="async"
                      className="block h-full w-full object-cover"
                    />
                    <label
                      className={`active-press absolute right-3 top-3 inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-white/25 bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md transition-colors hover:bg-black/75 ${
                        uploadingPhotoId === meal.id ? "pointer-events-none opacity-60" : ""
                      }`}
                    >
                      <IconCamera className="size-3.5" />
                      <span>{uploadingPhotoId === meal.id ? "Uploading..." : "Change photo"}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={uploadingPhotoId === meal.id}
                        onChange={(event) => {
                          const selected = event.target.files?.[0];
                          event.target.value = "";
                          void updateMealPhoto(meal, selected);
                        }}
                      />
                    </label>
                  </div>
                )}

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 text-base font-bold text-[var(--foreground)]">{title}</h3>
                    <span className="mt-1 inline-flex rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-muted)]">
                      {meal.visibility === "public" ? "Public" : "Private"}
                    </span>
                    {!recipe?.manual && (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--ink-muted)]">
                        {recipe?.description ?? `${meal.meal_plan_items.length} food items in this meal plan.`}
                      </p>
                    )}
                  </div>

                  <button
                    aria-label={meal.is_favorite ? `Remove ${title} from favorites` : `Add ${title} to favorites`}
                    aria-pressed={meal.is_favorite}
                    className={`active-press grid size-11 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] shadow-2xs transition-colors disabled:opacity-50 ${
                      meal.is_favorite
                        ? "text-[var(--sun)] hover:bg-[var(--surface-muted)]"
                        : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--sun)]"
                    }`}
                    disabled={updatingFavoriteId === meal.id}
                    onClick={() => void toggleFavorite(meal)}
                    type="button"
                  >
                    <IconStar className="size-5" fill={meal.is_favorite ? "currentColor" : "none"} />
                  </button>
                </div>

                <p className="mt-3 min-h-4 text-xs font-semibold text-[var(--leaf-ink)]">
                  {recipe?.manual
                    ? `Manual recipe · ${recipe.servings} serving${recipe.servings === 1 ? "" : "s"}`
                    : recipe
                      ? `${recipe.cookTimeMinutes} min · ${recipe.servings} servings`
                      : "\u00a0"}
                </p>

                {recipe?.manual && recipe.nutrition.calories <= 0 ? (
                  <p className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3 text-xs text-[var(--ink-muted)]">
                    Nutrition information wasn&apos;t provided for this manual recipe.
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
                        <p className="truncate text-[10px] font-bold uppercase text-[var(--ink-muted)]">{label}</p>
                        <p className="tabular-nums mt-0.5 truncate text-xs font-bold text-[var(--foreground)]">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t border-[var(--line)] pt-2">
                  <button
                    aria-expanded={viewingMealId === meal.id}
                    aria-controls={`meal-details-${meal.id}`}
                    className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--leaf-ink)] hover:underline"
                    onClick={() => setViewingMealId((current) => (current === meal.id ? null : meal.id))}
                    type="button"
                  >
                    {viewingMealId === meal.id ? "Hide details" : recipe ? "View recipe" : "View meal items"}
                  </button>
                  {viewingMealId === meal.id && (
                    <div className="mt-2 pb-2" id={`meal-details-${meal.id}`}>
                      {recipe ? (
                        <>
                          <h4 className="text-sm font-bold text-[var(--foreground)]">Ingredients</h4>
                          <ul className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                            {recipe.ingredients.map((ingredient, index) => (
                              <li key={`${ingredient.name}-${index}`}>{ingredient.name} — {ingredient.amount}</li>
                            ))}
                          </ul>
                          <h4 className="mt-4 text-sm font-bold text-[var(--foreground)]">Cooking steps</h4>
                          <ol className="mt-2 list-inside list-decimal space-y-2 text-sm leading-5 text-[var(--foreground)]">
                            {recipe.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
                          </ol>
                        </>
                      ) : (
                        <>
                          <h4 className="text-sm font-bold text-[var(--foreground)]">Meal items</h4>
                          <ul className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                            {meal.meal_plan_items.map((item) => (
                              <li key={item.id}>
                                {item.food_name} — {Math.round(Number(item.weight_g))}g ({Math.round(Number(item.calories))} kcal)
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
                  <button
                    className="active-press inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--leaf)] px-4 text-sm font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={(recipe?.manual && recipe.nutrition.calories <= 0) || loggingId === meal.id || deletingId === meal.id || uploadingPhotoId === meal.id}
                    onClick={() => void logMealNow(meal)}
                    title={recipe?.manual && recipe.nutrition.calories <= 0 ? "Nutrition information is needed to log this recipe." : undefined}
                    type="button"
                  >
                    <IconLog className="size-4" />
                    <span>{loggingId === meal.id ? "Logging..." : "Log meal"}</span>
                  </button>
                  {!(recipe?.imageUrl || coverImages[meal.id]) && (
                    <label
                      className={`active-press inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--leaf)] hover:text-[var(--foreground)] ${
                        uploadingPhotoId === meal.id ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      <IconCamera className="size-4" />
                      <span>{uploadingPhotoId === meal.id ? "Uploading..." : "Add photo"}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={uploadingPhotoId === meal.id}
                        onChange={(event) => {
                          const selected = event.target.files?.[0];
                          event.target.value = "";
                          void updateMealPhoto(meal, selected);
                        }}
                      />
                    </label>
                  )}
                  <button
                    aria-label={`Remove ${title} from My Plans`}
                    title="Remove from My Plans"
                    className="active-press inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--coral)]/40 text-[var(--coral)] hover:bg-[var(--coral-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={deletingId === meal.id || loggingId === meal.id || uploadingPhotoId === meal.id}
                    onClick={() => setPendingDeleteMeal(meal)}
                    type="button"
                  >
                    <IconTrash className="size-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(pendingDeleteMeal)}
        onClose={() => setPendingDeleteMeal(null)}
        role="alertdialog"
        titleId="meal-delete-title"
        descriptionId="meal-delete-description"
      >
        <h2 className="text-lg font-bold text-[var(--foreground)]" id="meal-delete-title">
          Remove this meal?
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]" id="meal-delete-description">
          Are you sure you want to remove{" "}
          <strong className="text-[var(--foreground)]">{pendingDeleteMeal?.recipe?.title ?? pendingDeleteMeal?.name}</strong>?
          {pendingDeleteMeal?.is_favorite ? " This removes it from My Plans and Favorites." : " This cannot be undone."}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            className="active-press min-h-11 rounded-xl border border-[var(--border-control)] text-sm font-bold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
            onClick={() => setPendingDeleteMeal(null)}
            type="button"
          >
            Keep meal
          </button>
          <button
            className="active-press min-h-11 rounded-xl bg-[var(--coral)] text-sm font-bold text-[var(--on-coral)] hover:opacity-90"
            onClick={() => {
              if (!pendingDeleteMeal) return;
              const target = pendingDeleteMeal;
              setPendingDeleteMeal(null);
              void deleteMeal(target.id);
            }}
            type="button"
          >
            Remove meal
          </button>
        </div>
      </Dialog>
    </section>
  );
}
