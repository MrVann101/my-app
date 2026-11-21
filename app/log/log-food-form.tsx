"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { computeNutrients, getWeightWarning } from "@/lib/food";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";
import { defaultMealTypeByHour, MEAL_SLOTS, normalizeMealSlot, type MealSlot } from "@/lib/meal-slot";
import type { NutrientRate } from "@/lib/types";
import { IconCheck, IconStar } from "@/components/icons";
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
  const [weightInput, setWeightInput] = useState("100");
  const [mealType, setMealType] = useState<MealSlot>(() => normalizeMealSlot(initialMealType) ?? "snack");
  const userChangedSlot = useRef(false);
  const portionSectionRef = useRef<HTMLDivElement>(null);

  const [rate, setRate] = useState<NutrientRate>(emptyRate);
  const [caloriesInput, setCaloriesInput] = useState("0");
  const [baseWeightInput, setBaseWeightInput] = useState("100");
  const [selectionHint, setSelectionHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [source, setSource] = useState<"manual" | "database">("manual");
  const [dataSource, setDataSource] = useState<"usda" | "off" | null>(null);

  useEffect(() => {
    const normalized = normalizeMealSlot(initialMealType);
    const timer = window.setTimeout(() => {
      if (normalized) {
        setMealType(normalized);
      } else if (!userChangedSlot.current) {
        setMealType(defaultMealTypeByHour());
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialMealType]);

  const parsedWeightG = useMemo(() => {
    const num = Number(weightInput);
    return Number.isFinite(num) && num > 0 ? Math.min(100000, num) : 0;
  }, [weightInput]);

  const parsedBaseCalories = useMemo(() => {
    const num = Number(caloriesInput);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  }, [caloriesInput]);

  const parsedBaseWeightG = useMemo(() => {
    const num = Number(baseWeightInput);
    return Number.isFinite(num) && num > 0 ? num : 0;
  }, [baseWeightInput]);

  const effectiveRate = useMemo(
    () => ({
      ...rate,
      caloriesPerG: parsedBaseWeightG > 0 ? parsedBaseCalories / parsedBaseWeightG : 0,
    }),
    [parsedBaseCalories, parsedBaseWeightG, rate],
  );

  const computed = useMemo(
    () => computeNutrients(parsedWeightG > 0 ? parsedWeightG : 1, effectiveRate),
    [effectiveRate, parsedWeightG],
  );
  const weightWarning = parsedWeightG > 0 ? getWeightWarning(parsedWeightG) : null;
  const hasNutritionPreview = foodName.trim().length > 0 && effectiveRate.caloriesPerG > 0 && parsedWeightG > 0;
  const canSubmit = !isSubmitting && !isSavingFavorite && foodName.trim().length > 0 && effectiveRate.caloriesPerG > 0 && parsedWeightG > 0;

  function handleFoodNameChange(name: string) {
    setFoodName(name);
    setSource("manual");
    setDataSource(null);
    setSelectionHint(null);
    const lower = name.trim().toLowerCase();
    const matchedRate = SMART_FOOD_RATES[lower];
    if (matchedRate) {
      setBaseWeightInput("100");
      setCaloriesInput(String(Math.round(matchedRate * 100)));
      setRate((prev) => ({ ...prev, caloriesPerG: matchedRate }));
    }
  }

  function handleSearchSelect(result: SearchResult | null) {
    if (!result) return;
    setFoodName(result.foodName);
    setWeightInput(String(result.defaultWeightG));
    setBaseWeightInput("100");
    setCaloriesInput(String(Math.round(result.nutrientRate.caloriesPerG * 100)));
    setRate(result.nutrientRate);
    setSource("database");
    setDataSource(result.dataSource);
    setError(null);
    setSaved(null);
    setSelectionHint(`Selected "${result.foodName}" — adjust your portion and log.`);
    portionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function adjustWeight(delta: number) {
    const base = parsedWeightG > 0 ? parsedWeightG : 0;
    const next = Math.max(1, Math.min(100000, Math.round(base + delta)));
    setWeightInput(String(next));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (parsedWeightG <= 0) {
      setError("Enter a portion weight above 0 grams.");
      return;
    }
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
          foodName: foodName.trim(),
          weightG: parsedWeightG,
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

      setSaved(`Logged "${foodName.trim()}" (${Math.round(computed.calories)} kcal) to today's journal.`);
      setFoodName("");
      setRate(emptyRate);
      setCaloriesInput("0");
      setBaseWeightInput("100");
      setWeightInput("100");
      setSelectionHint(null);
      setSource("manual");
      setDataSource(null);
    } catch {
      setError("Unable to save this food log. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveFavorite() {
    if (parsedWeightG <= 0) return;
    setError(null);
    setIsSavingFavorite(true);
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foodName: foodName.trim(), defaultWeightG: parsedWeightG, nutrientRate: effectiveRate }),
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-4 text-xs font-bold text-[var(--leaf-ink)]" role="status">
          <span className="inline-flex items-center gap-1.5">
            <IconCheck className="size-4 shrink-0" />
            <span>{saved}</span>
          </span>
          <Link href="/dashboard" className="underline underline-offset-2 hover:opacity-80">
            View Dashboard →
          </Link>
        </div>
      )}

      {selectionHint && !saved && (
        <div className="rounded-xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] px-4 py-2.5 text-xs font-semibold text-[var(--leaf-ink)]" role="status">
          {selectionHint}
        </div>
      )}

      <form className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-start" onSubmit={handleSubmit}>
        {/* Food Input Details Card */}
        <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-5">
          <div>
            <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]" htmlFor="log-food-name">
              Food Name
            </label>
            <input
              id="log-food-name"
              className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 text-sm font-semibold outline-none focus:border-[var(--leaf)]"
              placeholder="e.g. Fried Chicken, White Rice, Boiled Egg..."
              value={foodName}
              onChange={(event) => handleFoodNameChange(event.target.value)}
              required
            />
          </div>
          <p className="text-xs leading-5 text-[var(--ink-muted)]">
            Pick a database food above, type a common food (auto-fills rate), or enter calories per reference weight below.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)]" htmlFor="log-base-kcal">
                Calories per Ref (kcal)
              </label>
              <input
                id="log-base-kcal"
                className="tabular-nums mt-1 h-11 w-full rounded-lg border border-[var(--border-control)] bg-[var(--surface)] px-3 text-sm font-bold outline-none focus:border-[var(--leaf)]"
                min="0"
                step="1"
                type="number"
                inputMode="numeric"
                value={caloriesInput}
                onChange={(event) => setCaloriesInput(event.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)]" htmlFor="log-base-weight">
                Reference Weight (g)
              </label>
              <input
                id="log-base-weight"
                className="tabular-nums mt-1 h-11 w-full rounded-lg border border-[var(--border-control)] bg-[var(--surface)] px-3 text-sm font-bold outline-none focus:border-[var(--leaf)]"
                min="1"
                step="1"
                type="number"
                inputMode="numeric"
                value={baseWeightInput}
                onChange={(event) => setBaseWeightInput(event.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Portion Weight, Meal Slot & Submit Card */}
        <div
          ref={portionSectionRef}
          className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs lg:sticky lg:top-28"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]" htmlFor="log-portion-weight">
                Your Portion (g)
              </label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <input
                  id="log-portion-weight"
                  className="tabular-nums h-11 min-w-[96px] flex-1 rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 text-base font-bold outline-none focus:border-[var(--leaf)]"
                  min="1"
                  max="100000"
                  step="1"
                  type="number"
                  inputMode="numeric"
                  enterKeyHint="done"
                  value={weightInput}
                  onChange={(event) => setWeightInput(event.target.value)}
                  required
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustWeight(-10)}
                    className="active-press grid min-h-11 min-w-11 place-items-center rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] px-2 text-xs font-bold text-[var(--foreground)] hover:border-[var(--leaf)]"
                    aria-label="Decrease portion by 10 grams"
                  >
                    -10
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustWeight(10)}
                    className="active-press grid min-h-11 min-w-11 place-items-center rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] px-2 text-xs font-bold text-[var(--foreground)] hover:border-[var(--leaf)]"
                    aria-label="Increase portion by 10 grams"
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustWeight(50)}
                    className="active-press grid min-h-11 min-w-11 place-items-center rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] px-2 text-xs font-bold text-[var(--foreground)] hover:border-[var(--leaf)]"
                    aria-label="Increase portion by 50 grams"
                  >
                    +50
                  </button>
                </div>
              </div>
              {weightWarning && <span className="mt-1.5 block text-xs font-semibold text-[var(--warning)]">{weightWarning}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]" htmlFor="log-meal-slot">
                Meal
              </label>
              <select
                id="log-meal-slot"
                className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 text-sm font-semibold outline-none focus:border-[var(--leaf)]"
                value={mealType}
                onChange={(event) => {
                  userChangedSlot.current = true;
                  setMealType(event.target.value as MealSlot);
                }}
              >
                {MEAL_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value}>{slot.label}</option>
                ))}
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
              className="active-press min-h-12 rounded-xl bg-[var(--leaf)] px-4 text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
              disabled={!canSubmit}
              type="submit"
            >
              {isSubmitting ? "Logging..." : "Log to Today's Journal"}
            </button>
            <button
              className="active-press inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--leaf)] shadow-2xs hover:bg-[var(--surface-muted)] disabled:opacity-50"
              disabled={!canSubmit}
              onClick={() => void saveFavorite()}
              type="button"
            >
              <IconStar className="size-4" />
              <span>{isSavingFavorite ? "Saving..." : "Save Favorite"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
