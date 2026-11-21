"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconCheck, IconMealPlans, IconSparkles, IconX } from "@/components/icons";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";
import { defaultMealTypeByHour, MEAL_SLOTS, normalizeMealSlot, type MealSlot } from "@/lib/meal-slot";

type SavedMeal = {
  id: number;
  name: string;
  total_calories: number;
  recipe: {
    title: string;
    nutrition: {
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
    };
  } | null;
  meal_plan_items: {
    id: number;
    meal_type: string;
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }[];
};

export default function SavedMealsTab({ initialMealType }: { initialMealType?: string } = {}) {
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loggingId, setLoggingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>(() => normalizeMealSlot(initialMealType) ?? "snack");
  const userChangedSlot = useRef(false);

  useEffect(() => {
    const normalized = normalizeMealSlot(initialMealType);
    const timer = window.setTimeout(() => {
      if (normalized) {
        setSelectedSlot(normalized);
      } else if (!userChangedSlot.current) {
        setSelectedSlot(defaultMealTypeByHour());
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialMealType]);

  useEffect(() => {
    let active = true;
    async function fetchMeals() {
      try {
        const response = await fetch("/api/meal-plans", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Unable to load saved meals.");
        if (active) setMeals(payload.plans ?? []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load saved meals.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void fetchMeals();
    return () => {
      active = false;
    };
  }, []);

  async function handleLogMeal(meal: SavedMeal) {
    setError(null);
    setStatus(null);
    setLoggingId(meal.id);

    try {
      const logDate = getBrowserDate();
      const timezone = getBrowserTimezone();
      const recipe = meal.recipe;

      if (!recipe) {
        const response = await fetch(`/api/meal-plans/${meal.id}/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logDate, timezone, mealType: selectedSlot }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Unable to log this meal plan.");
        setStatus(`Logged "${meal.name}" as ${selectedSlot} (${meal.total_calories.toLocaleString()} kcal).`);
        return;
      }

      const logResponse = await fetch("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate,
          timezone,
          mealType: selectedSlot,
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
      setStatus(`Logged "${recipe.title}" as ${selectedSlot} (${recipe.nutrition.calories.toLocaleString()} kcal).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log meal.");
    } finally {
      setLoggingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
        <span className="text-xs font-bold text-[var(--foreground)]">Log into meal slot:</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Meal slot">
          {MEAL_SLOTS.map((slot) => (
            <button
              key={slot.value}
              type="button"
              aria-pressed={selectedSlot === slot.value}
              onClick={() => {
                userChangedSlot.current = true;
                setSelectedSlot(slot.value);
              }}
              className={`active-press min-h-11 rounded-xl px-3.5 text-xs font-semibold capitalize transition-colors ${
                selectedSlot === slot.value
                  ? "bg-[var(--leaf)] text-[var(--on-leaf)] shadow-2xs"
                  : "border border-[var(--border-control)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] p-4 text-xs font-semibold text-[var(--coral)]" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3 py-4">
          <div className="h-16 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
          <div className="h-16 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        </div>
      ) : meals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] p-8 text-center">
          <IconMealPlans className="mx-auto size-8 text-[var(--ink-muted)]" />
          <h2 className="mt-2 text-sm font-bold text-[var(--foreground)]">No saved recipes or meals yet</h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Create custom recipes or save meals in Meal Plans to log them here in 1 tap.
          </p>
          <Link
            href="/meal-plans"
            className="active-press mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--leaf)] px-4 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)]"
          >
            <IconSparkles className="size-3.5" />
            <span>Go to Meal Plans</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {meals.map((meal) => {
            const isLogging = loggingId === meal.id;
            const calories = meal.recipe ? meal.recipe.nutrition.calories : meal.total_calories;
            const title = meal.recipe ? meal.recipe.title : meal.name;
            const protein = meal.recipe
              ? meal.recipe.nutrition.proteinG
              : meal.meal_plan_items.reduce((sum, item) => sum + (item.protein_g || 0), 0);
            const carbs = meal.recipe
              ? meal.recipe.nutrition.carbsG
              : meal.meal_plan_items.reduce((sum, item) => sum + (item.carbs_g || 0), 0);
            const fat = meal.recipe
              ? meal.recipe.nutrition.fatG
              : meal.meal_plan_items.reduce((sum, item) => sum + (item.fat_g || 0), 0);

            return (
              <div
                key={meal.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xs transition-colors hover:border-[var(--leaf)]/40 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong className="truncate text-sm font-bold text-[var(--foreground)]">{title}</strong>
                    <span className="shrink-0 rounded-md bg-[var(--leaf-light)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--leaf-ink)]">
                      {meal.recipe ? "Recipe" : "Meal Plan"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--ink-muted)]">
                    <span className="tabular-nums font-bold text-[var(--leaf)]">{Math.round(calories).toLocaleString()} kcal</span>
                    <span>·</span>
                    <span className="tabular-nums">P {Math.round(protein)}g</span>
                    <span>·</span>
                    <span className="tabular-nums">C {Math.round(carbs)}g</span>
                    <span>·</span>
                    <span className="tabular-nums">F {Math.round(fat)}g</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isLogging}
                  onClick={() => void handleLogMeal(meal)}
                  className="active-press inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--leaf)] px-4 py-2 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
                >
                  {isLogging ? "Logging..." : "+ Log to Today"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {status && (
        <div
          className="fixed bottom-24 left-4 right-4 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-[var(--leaf)] bg-[var(--leaf-light)] px-4 py-3 text-xs font-bold text-[var(--leaf-ink)] shadow-lg md:bottom-6"
          role="status"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <IconCheck className="size-4 shrink-0" />
            <span className="truncate">{status}</span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/dashboard" className="underline underline-offset-2 hover:opacity-80">
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => setStatus(null)}
              aria-label="Dismiss message"
              className="grid size-8 place-items-center rounded-lg hover:bg-[var(--surface)]/50"
            >
              <IconX className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
