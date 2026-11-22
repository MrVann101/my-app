"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeNutrients, getWeightWarning } from "@/lib/food";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";
import { defaultMealTypeByHour, MEAL_SLOTS, normalizeMealSlot, type MealSlot } from "@/lib/meal-slot";
import type { NutrientRate } from "@/lib/types";
import { IconCheck, IconChevronRight, IconSearch, IconStar, IconX } from "@/components/icons";

export type SearchResult = {
  providerId: string;
  foodName: string;
  brandName: string | null;
  defaultWeightG: number;
  nutrientRate: NutrientRate;
  dataSource: "usda" | "off";
};

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
  const suppressNextSearchRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const [rate, setRate] = useState<NutrientRate>(emptyRate);
  const [caloriesInput, setCaloriesInput] = useState("0");
  const [baseWeightInput, setBaseWeightInput] = useState("100");
  const [source, setSource] = useState<"manual" | "database">("manual");
  const [dataSource, setDataSource] = useState<"usda" | "off" | null>(null);
  const [isAutoEstimated, setIsAutoEstimated] = useState(false);

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [dismissedSearch, setDismissedSearch] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);

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

  const runSearch = useCallback(async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (trimmed.length < 2) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await fetch(`/api/food/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) {
        setSearchError(payload.error?.message ?? "Food search is unavailable right now.");
        return;
      }
      setSearchResults(payload.results ?? []);
      setLastSearchedQuery(trimmed);
      setHasSearched(true);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setSearchError("Unable to search foods. Check your connection and try again.");
    } finally {
      if (abortRef.current === controller) {
        setIsSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      return;
    }

    const trimmed = foodName.trim();
    if (trimmed.length < 2) {
      abortRef.current?.abort();
      const timer = window.setTimeout(() => {
        setIsSearching(false);
        setSearchResults([]);
        setHasSearched(false);
        setSearchError(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      void runSearch(trimmed);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [foodName, runSearch]);

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
  const canSubmit =
    !isSubmitting &&
    !isSavingFavorite &&
    foodName.trim().length > 0 &&
    effectiveRate.caloriesPerG > 0 &&
    parsedWeightG > 0;

  function handleFoodNameChange(name: string) {
    suppressNextSearchRef.current = false;
    setDismissedSearch(false);
    setFoodName(name);
    setSource("manual");
    setDataSource(null);
    setSaved(null);

    const lower = name.trim().toLowerCase();
    const matchedRate = SMART_FOOD_RATES[lower];
    if (matchedRate) {
      setBaseWeightInput("100");
      setCaloriesInput(String(Math.round(matchedRate * 100)));
      setRate({ ...emptyRate, caloriesPerG: matchedRate });
      setIsAutoEstimated(true);
    } else {
      setIsAutoEstimated(false);
    }
  }

  function handleSearchSelect(result: SearchResult) {
    suppressNextSearchRef.current = true;
    abortRef.current?.abort();
    setFoodName(result.foodName);
    setWeightInput(String(result.defaultWeightG));
    setBaseWeightInput("100");
    setCaloriesInput(String(Math.round(result.nutrientRate.caloriesPerG * 100)));
    setRate(result.nutrientRate);
    setSource("database");
    setDataSource(result.dataSource);
    setIsAutoEstimated(false);
    setSearchResults([]);
    setHasSearched(false);
    setSearchError(null);
    setDismissedSearch(true);
    setError(null);
    setSaved(null);
    portionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function handleClearFood() {
    suppressNextSearchRef.current = false;
    abortRef.current?.abort();
    setFoodName("");
    setRate(emptyRate);
    setCaloriesInput("0");
    setBaseWeightInput("100");
    setWeightInput("100");
    setSource("manual");
    setDataSource(null);
    setIsAutoEstimated(false);
    setSearchResults([]);
    setHasSearched(false);
    setLastSearchedQuery("");
    setSearchError(null);
    setDismissedSearch(false);
    setIsSearching(false);
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

      const loggedName = foodName.trim();
      handleClearFood();
      setSaved(`Logged "${loggedName}" (${Math.round(computed.calories)} kcal) to today's journal.`);
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

  const showSearchResults = !dismissedSearch && searchResults.length > 0 && source !== "database";
  const nutritionStatusLabel =
    source === "database"
      ? `Verified ${dataSource === "off" ? "OFF" : "USDA"} match`
      : isAutoEstimated
        ? "Auto-estimated"
        : "Custom entry";

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {saved && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-4 text-xs font-bold text-[var(--leaf-ink)]"
          role="status"
        >
          <span className="inline-flex items-center gap-1.5">
            <IconCheck className="size-4 shrink-0" />
            <span>{saved}</span>
          </span>
          <Link href="/dashboard" className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:opacity-80">
            <span>View Dashboard</span>
            <IconChevronRight className="size-3.5" />
          </Link>
        </div>
      )}

      {/* Unified Food Name or Search Field */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]" htmlFor="log-food-name">
            Food Name or Search
          </label>
          {source === "database" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--leaf-light)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--leaf-ink)]">
              <IconCheck className="size-3.5" />
              <span>{nutritionStatusLabel}</span>
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              id="log-food-name"
              className="h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] pl-4 pr-11 text-sm font-semibold outline-none transition-colors focus:border-[var(--leaf)]"
              placeholder="Search database or type custom food (e.g. chicken, rice, egg)..."
              enterKeyHint="search"
              value={foodName}
              onChange={(event) => handleFoodNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && effectiveRate.caloriesPerG <= 0 && foodName.trim().length >= 2) {
                  event.preventDefault();
                  suppressNextSearchRef.current = false;
                  setDismissedSearch(false);
                  void runSearch(foodName);
                }
              }}
              required
            />
            {foodName && (
              <button
                type="button"
                onClick={handleClearFood}
                aria-label="Clear food name and search"
                className="active-press absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              >
                <IconX className="size-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            disabled={isSearching || foodName.trim().length < 2}
            onClick={() => {
              suppressNextSearchRef.current = false;
              setDismissedSearch(false);
              void runSearch(foodName);
            }}
            aria-label="Search food database"
            title="Search food database"
            className="active-press flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--leaf)] text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
          >
            <IconSearch className="size-5" />
          </button>
        </div>

        {searchError && (
          <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] p-3.5 text-xs font-semibold text-[var(--coral)]" role="alert">
            {searchError}
          </p>
        )}

        {isSearching && (
          <div className="space-y-2" aria-live="polite" aria-label="Searching foods">
            <div className="h-16 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
            <div className="h-16 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
          </div>
        )}

        {!isSearching && hasSearched && searchResults.length === 0 && !searchError && !dismissedSearch && source !== "database" && (
          <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-muted)]/60 px-4 py-3 text-xs text-[var(--ink-muted)]" role="status">
            No database matches for <strong className="text-[var(--foreground)]">&quot;{lastSearchedQuery}&quot;</strong>. Enter calories below to log it as a custom food.
          </div>
        )}

        {!isSearching && showSearchResults && (
          <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--background)]/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-xs font-semibold text-[var(--ink-muted)]">
                {searchResults.length} database {searchResults.length === 1 ? "match" : "matches"} — pick one or enter custom below
              </p>
              <button
                type="button"
                onClick={() => setDismissedSearch(true)}
                className="active-press inline-flex min-h-11 items-center rounded-lg px-2.5 text-xs font-bold text-[var(--leaf-ink)] hover:bg-[var(--leaf-light)]"
              >
                Use as custom food
              </button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
              {searchResults.map((result) => {
                const isGeneric = !result.brandName;
                return (
                  <div
                    key={`${result.dataSource}-${result.providerId}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 transition-colors hover:border-[var(--leaf)]/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong className="truncate text-sm font-bold text-[var(--foreground)]">{result.foodName}</strong>
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                            isGeneric
                              ? "bg-[var(--leaf-light)] text-[var(--leaf-ink)]"
                              : "bg-[var(--surface-muted)] text-[var(--ink-muted)]"
                          }`}
                        >
                          {isGeneric ? "Whole food" : result.brandName}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--ink-muted)]">
                        <span className="tabular-nums font-semibold text-[var(--leaf)]">
                          {Math.round(result.nutrientRate.caloriesPerG * result.defaultWeightG)} kcal
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">{result.defaultWeightG}g</span>
                        <span>·</span>
                        <span className="tabular-nums">P {Math.round(result.nutrientRate.proteinPerG * result.defaultWeightG)}g</span>
                        <span className="tabular-nums">C {Math.round(result.nutrientRate.carbsPerG * result.defaultWeightG)}g</span>
                        <span className="tabular-nums">F {Math.round(result.nutrientRate.fatPerG * result.defaultWeightG)}g</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSearchSelect(result)}
                      className="active-press inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--leaf)] px-3.5 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)]"
                    >
                      Select
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Reference Nutrition & Portion Grid */}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
              Nutrition per Reference
            </h2>
            <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--ink-muted)]">
              {nutritionStatusLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)]" htmlFor="log-base-kcal">
                Calories per Ref (kcal)
              </label>
              <input
                id="log-base-kcal"
                className="tabular-nums mt-1.5 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 text-sm font-bold outline-none focus:border-[var(--leaf)]"
                min="0"
                step="1"
                type="number"
                inputMode="numeric"
                value={caloriesInput}
                onChange={(event) => {
                  setCaloriesInput(event.target.value);
                  setIsAutoEstimated(false);
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)]" htmlFor="log-base-weight">
                Reference Weight (g)
              </label>
              <input
                id="log-base-weight"
                className="tabular-nums mt-1.5 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 text-sm font-bold outline-none focus:border-[var(--leaf)]"
                min="1"
                step="1"
                type="number"
                inputMode="numeric"
                value={baseWeightInput}
                onChange={(event) => setBaseWeightInput(event.target.value)}
              />
            </div>
          </div>

          {(rate.proteinPerG > 0 || rate.carbsPerG > 0 || rate.fatPerG > 0) && parsedBaseWeightG > 0 && (
            <div className="tabular-nums flex flex-wrap gap-2 text-[11px] text-[var(--ink-muted)]">
              <span className="rounded-lg bg-[var(--surface)] px-2.5 py-1 font-semibold">
                Protein {Math.round(rate.proteinPerG * parsedBaseWeightG)}g
              </span>
              <span className="rounded-lg bg-[var(--surface)] px-2.5 py-1 font-semibold">
                Carbs {Math.round(rate.carbsPerG * parsedBaseWeightG)}g
              </span>
              <span className="rounded-lg bg-[var(--surface)] px-2.5 py-1 font-semibold">
                Fat {Math.round(rate.fatPerG * parsedBaseWeightG)}g
              </span>
            </div>
          )}

          <p className="text-xs leading-5 text-[var(--ink-muted)]">
            Search above to auto-fill database nutrition, or enter calories for any custom portion weight.
          </p>
        </div>

        <div
          ref={portionSectionRef}
          className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs sm:p-5 lg:sticky lg:top-24"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]" htmlFor="log-portion-weight">
                Your Portion (g)
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  id="log-portion-weight"
                  className="tabular-nums h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 text-base font-bold outline-none focus:border-[var(--leaf)] sm:min-w-[96px] sm:flex-1"
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
                <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0 sm:gap-1.5">
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
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]" htmlFor="log-meal-slot">
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

          {hasNutritionPreview ? (
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--surface-muted)] p-3 text-center">
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
          ) : (
            <p className="rounded-xl bg-[var(--surface-muted)] px-3.5 py-2.5 text-xs text-[var(--ink-muted)]">
              Enter a food name and calories above (or select a database match) to preview totals and log.
            </p>
          )}

          {error && <p className="text-xs font-bold text-[var(--coral)]" role="alert">{error}</p>}

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              className="active-press min-h-12 w-full rounded-xl bg-[var(--leaf)] px-4 text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
              disabled={!canSubmit}
              type="submit"
            >
              {isSubmitting ? "Logging..." : "Log to Today's Journal"}
            </button>
            <button
              className="active-press inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--leaf)] shadow-2xs hover:bg-[var(--surface-muted)] disabled:opacity-50"
              disabled={!canSubmit}
              onClick={() => void saveFavorite()}
              type="button"
            >
              <IconStar className="size-4" />
              <span>{isSavingFavorite ? "Saving..." : "Save Favorite"}</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
