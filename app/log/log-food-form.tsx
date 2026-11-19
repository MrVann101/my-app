"use client";

import { FormEvent, useMemo, useState } from "react";
import { computeNutrients, getWeightWarning } from "@/lib/food";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";
import type { NutrientRate } from "@/lib/types";
import { IconStar } from "@/components/icons";
import FoodSearch, { type SearchResult } from "./food-search";

const emptyRate: NutrientRate = {
  caloriesPerG: 0,
  proteinPerG: 0,
  carbsPerG: 0,
  fatPerG: 0,
  fiberPerG: 0,
  sodiumPerG: 0,
  sugarPerG: 0,
};

const SMART_FOOD_RATES: Record<string, number> = {
  chicken: 2.2,
  "fried chicken": 2.4,
  "chicken breast": 1.65,
  egg: 1.55,
  "boiled egg": 1.55,
  rice: 1.3,
  "white rice": 1.3,
  apple: 0.52,
  banana: 0.89,
  pizza: 2.66,
  salmon: 2.08,
  steak: 2.5,
  bread: 2.65,
  toast: 2.65,
  burger: 2.5,
  salad: 0.4,
  milk: 0.6,
  oats: 3.89,
};

export default function LogFoodForm({ initialMealType }: { initialMealType?: string } = {}) {
  const [foodName, setFoodName] = useState("");
  const [weightG, setWeightG] = useState(100);
  const [mealType, setMealType] = useState(() => {
    if (initialMealType && ["breakfast", "lunch", "dinner", "snack"].includes(initialMealType.toLowerCase())) {
      return initialMealType.toLowerCase();
    }
    return "snack";
  });
  const [rate, setRate] = useState<NutrientRate>(emptyRate);
  const [labelCalories, setLabelCalories] = useState(0);
  const [labelWeightG, setLabelWeightG] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [source, setSource] = useState<"manual" | "database">("manual");
  const [dataSource, setDataSource] = useState<"usda" | "off" | null>(null);

  const effectiveRate = useMemo(
    () => ({
      ...rate,
      caloriesPerG: labelWeightG > 0 ? labelCalories / labelWeightG : 0,
    }),
    [labelCalories, labelWeightG, rate]
  );

  const computed = useMemo(() => computeNutrients(weightG, effectiveRate), [effectiveRate, weightG]);
  const weightWarning = getWeightWarning(weightG);
  const hasNutritionPreview = foodName.trim().length > 0 && effectiveRate.caloriesPerG > 0;

  const handleFoodNameChange = (name: string) => {
    setFoodName(name);
    setSource("manual");
    setDataSource(null);
    const lower = name.trim().toLowerCase();
    const matchedRate = SMART_FOOD_RATES[lower];
    if (matchedRate) {
      setLabelWeightG(100);
      setLabelCalories(Math.round(matchedRate * 100));
      setRate((prev) => ({ ...prev, caloriesPerG: matchedRate }));
    }

  };

  const handleSearchSelect = (result: SearchResult | null) => {
    if (!result) return;
    setFoodName(result.foodName);
    setWeightG(result.defaultWeightG);
    setLabelWeightG(100);
    setLabelCalories(Math.round(result.nutrientRate.caloriesPerG * 100));
    setRate(result.nutrientRate);
    setSource("database");
    setDataSource(result.dataSource);
    setError(null);
    setSaved(null);
  };

  function adjustWeight(delta: number) {
    setWeightG((prev) => Math.max(1, Math.min(100000, prev + delta)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/food/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logDate: getBrowserDate(),
        timezone: getBrowserTimezone(),
        mealType,
        foodName,
        weightG,
        nutrientRate: effectiveRate,
        source,
        dataSource,
        aiConfidence: null,
      }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to save this food log.");
        return;
      }

      setSaved(`Successfully logged "${foodName}" (${Math.round(computed.calories)} kcal) to today's journal.`);

      setFoodName("");
      setRate(emptyRate);
      setLabelCalories(0);
      setLabelWeightG(100);
      setWeightG(100);
      setSource("manual");
      setDataSource(null);
    } catch {
      setError("Unable to save this food log. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveFavorite() {
    setError(null);
    setIsSavingFavorite(true);
    try {
      const response = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foodName, defaultWeightG: weightG, nutrientRate: effectiveRate }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to save favorite.");
        return;
      }
      setSaved(`Saved "${payload.favorite.food_name}" as a favorite.`);
    } catch {
      setError("Unable to save favorite. Check your connection and try again.");
    } finally {
      setIsSavingFavorite(false);
    }
  }

  return (
    <div className="space-y-6">
      <FoodSearch onSelect={handleSearchSelect} onAdd={handleSearchSelect} />

      {saved && (
        <div className="rounded-xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-4 text-xs font-bold text-[var(--leaf-ink)]" role="status">
          {saved}
        </div>
      )}

      {/* Food Input Details Card */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-5 space-y-4">
        <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]">
          Food Name
          <input
            className="mt-1.5 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold outline-none focus:border-[var(--leaf)]"
            placeholder="e.g. Fried Chicken, White Rice, Boiled Egg..."
            value={foodName}
            onChange={(event) => handleFoodNameChange(event.target.value)}
            required
          />
        </label>
        <p className="text-xs text-[var(--ink-muted)]">
          Smart rates automatically populate for common foods (e.g. Fried Chicken = 2.4 cal/g), or enter total calories & weight below.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-[var(--ink-muted)]">
            Calories per Portion
            <input
              className="mt-1 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-bold"
              min="0"
              step="1"
              type="number"
              value={labelCalories}
              onChange={(event) => setLabelCalories(Number(event.target.value))}
            />
          </label>
          <label className="text-xs font-semibold text-[var(--ink-muted)]">
            Base Weight (g)
            <input
              className="mt-1 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-bold"
              min="1"
              step="1"
              type="number"
              value={labelWeightG}
              onChange={(event) => setLabelWeightG(Number(event.target.value))}
            />
          </label>
        </div>
      </div>

      {/* Portion Weight & Meal Form */}
      <form className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-5 shadow-xs" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]">Portion Weight (g)</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                className="tabular-nums h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-base font-bold outline-none focus:border-[var(--leaf)]"
                min="1"
                max="100000"
                step="1"
                type="number"
                value={weightG}
                onChange={(event) => setWeightG(Number(event.target.value))}
                required
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => adjustWeight(-10)}
                  className="active-press grid size-10 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] text-xs font-bold text-[var(--foreground)] hover:bg-[var(--line)]"
                  title="Decrease 10g"
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() => adjustWeight(10)}
                  className="active-press grid size-10 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] text-xs font-bold text-[var(--foreground)] hover:bg-[var(--line)]"
                  title="Increase 10g"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => adjustWeight(50)}
                  className="active-press grid size-10 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] text-xs font-bold text-[var(--foreground)] hover:bg-[var(--line)]"
                  title="Increase 50g"
                >
                  +50
                </button>
              </div>
            </div>
            {weightWarning && <span className="mt-1.5 block text-xs font-semibold text-[var(--sun)]">{weightWarning}</span>}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]">Meal Event</label>
            <select
              className="mt-1.5 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-semibold outline-none focus:border-[var(--leaf)]"
              value={mealType}
              onChange={(event) => setMealType(event.target.value)}
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>
        </div>

        {hasNutritionPreview && (
          <div className="grid grid-cols-3 gap-2.5 rounded-xl bg-[var(--surface-muted)] p-3 text-center">
            <div>
              <span className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">Calories</span>
              <strong className="tabular-nums block text-xl font-extrabold text-[var(--foreground)]">
                {Math.round(computed.calories)}
              </strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">Protein</span>
              <strong className="tabular-nums block text-xl font-extrabold text-[var(--leaf)]">
                {Math.round(computed.proteinG)}g
              </strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">Rate</span>
              <strong className="tabular-nums block text-xl font-extrabold text-[var(--ink-muted)]">
                {effectiveRate.caloriesPerG.toFixed(2)} <span className="text-[10px]">cal/g</span>
              </strong>
            </div>
          </div>
        )}

        {error && <p className="text-xs font-bold text-[var(--coral)]" role="alert">{error}</p>}

        <div className="grid gap-2.5 sm:grid-cols-2">
          <button
            className="active-press h-12 rounded-xl bg-[var(--leaf)] text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
            disabled={isSubmitting || isSavingFavorite || !foodName || effectiveRate.caloriesPerG <= 0}
            type="submit"
          >
            Log to Today&apos;s Journal
          </button>
          <button
            className="active-press h-12 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-bold text-[var(--leaf)] shadow-2xs hover:bg-[var(--surface-muted)] disabled:opacity-50"
            disabled={isSubmitting || isSavingFavorite || !foodName || effectiveRate.caloriesPerG <= 0}
            onClick={() => void saveFavorite()}
            type="button"
          >
            <IconStar aria-hidden="true" className="mr-1 inline size-4" />
            {isSavingFavorite ? "Saving favorite..." : "Save as Favorite"}
          </button>
        </div>
      </form>
    </div>
  );
}
