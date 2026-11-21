"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconCheck, IconRefresh } from "@/components/icons";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";
import { defaultMealTypeByHour, MEAL_SLOTS, normalizeMealSlot, type MealSlot } from "@/lib/meal-slot";

type Favorite = {
  id: number;
  food_name: string;
  default_weight_g: number;
  calories_per_g: number;
  protein_per_g: number;
  carbs_per_g: number;
  fat_per_g: number;
  fiber_per_g: number;
  sodium_per_g: number;
  sugar_per_g: number;
  use_count: number;
};

export default function Favorites({
  onLogged,
  initialMealType,
}: {
  onLogged?: () => void;
  initialMealType?: string;
}) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
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

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/favorites", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to load favorites.");
        return;
      }
      setFavorites(payload.favorites ?? []);
    } catch {
      setError("Unable to load favorites. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function relog(favorite: Favorite) {
    if (loggingId !== null) return;
    setError(null);
    setStatus(null);
    setLoggingId(favorite.id);
    try {
      const response = await fetch("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate: getBrowserDate(),
          timezone: getBrowserTimezone(),
          mealType: selectedSlot,
          foodName: favorite.food_name,
          weightG: favorite.default_weight_g,
          nutrientRate: {
            caloriesPerG: favorite.calories_per_g,
            proteinPerG: favorite.protein_per_g,
            carbsPerG: favorite.carbs_per_g,
            fatPerG: favorite.fat_per_g,
            fiberPerG: favorite.fiber_per_g,
            sodiumPerG: favorite.sodium_per_g,
            sugarPerG: favorite.sugar_per_g,
          },
          source: "database",
          dataSource: null,
          aiConfidence: null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to log favorite.");
        return;
      }
      setStatus(`Added "${favorite.food_name}" to ${selectedSlot}.`);
      await load();
      onLogged?.();
    } catch {
      setError("Unable to log favorite. Check your connection and try again.");
    } finally {
      setLoggingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[var(--foreground)]">Favorites & Recent Foods</h2>
          <p className="text-xs text-[var(--ink-muted)]">One-tap re-logging for your go-to portions.</p>
        </div>
        <button
          className="active-press inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] px-3 text-xs font-semibold text-[var(--foreground)] hover:border-[var(--leaf)]"
          onClick={() => void load()}
          type="button"
          title="Refresh favorites"
          aria-label="Refresh favorites"
        >
          <IconRefresh className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
        <span className="text-xs font-bold text-[var(--foreground)]">Log into meal slot:</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Favorite meal slot">
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

      {status && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-4 text-xs font-bold text-[var(--leaf-ink)]" role="status">
          <span className="inline-flex items-center gap-1.5">
            <IconCheck className="size-4 shrink-0" />
            <span>{status}</span>
          </span>
          <Link href="/dashboard" className="underline underline-offset-2 hover:opacity-80">
            View Dashboard →
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2.5 py-2">
          <div className="h-16 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          <div className="h-16 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
        </div>
      ) : favorites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] p-6 text-center text-xs text-[var(--ink-muted)]">
          No favorites saved yet. Save a frequent food from <strong>Search & Custom</strong> to re-log its default portion in one tap.
        </div>
      ) : (
        <div className="space-y-2.5">
          {favorites.map((favorite) => {
            const isLogging = loggingId === favorite.id;
            const portionKcal = Math.round(favorite.default_weight_g * favorite.calories_per_g);
            return (
              <div
                className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3.5 sm:flex-row sm:items-center sm:justify-between"
                key={favorite.id}
              >
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-bold text-[var(--foreground)]">{favorite.food_name}</strong>
                  <span className="tabular-nums text-xs text-[var(--ink-muted)]">
                    <span className="font-semibold text-[var(--leaf)]">{portionKcal} kcal</span> · {favorite.default_weight_g}g · logged {favorite.use_count} {favorite.use_count === 1 ? "time" : "times"}
                  </span>
                </div>
                <button
                  className="active-press inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--leaf)] px-4 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
                  disabled={loggingId !== null}
                  onClick={() => void relog(favorite)}
                  type="button"
                >
                  {isLogging ? "Logging..." : "Log portion"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
