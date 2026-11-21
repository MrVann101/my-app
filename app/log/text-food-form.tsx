"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { computeNutrients } from "@/lib/food";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";
import { defaultMealTypeByHour, MEAL_SLOTS, normalizeMealSlot, type MealSlot } from "@/lib/meal-slot";
import type { AiTextEstimate } from "@/lib/types";
import { IconCheck, IconX } from "@/components/icons";

type EditableTextItem = AiTextEstimate & {
  id: string;
  weightText: string;
};

function createItemId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function TextFoodForm({ initialMealType }: { initialMealType?: string } = {}) {
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<EditableTextItem[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mealType, setMealType] = useState<MealSlot>(() => normalizeMealSlot(initialMealType) ?? "snack");
  const userChangedSlot = useRef(false);

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

  const totalCalories = useMemo(
    () => items.reduce((sum, item) => sum + computeNutrients(item.estimatedWeightG, item.nutrientRate).calories, 0),
    [items],
  );

  async function analyze() {
    setError(null);
    setStatus(null);
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/food/analyze-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Description analysis failed. Try Search & Custom instead.");
        return;
      }
      const parsed: AiTextEstimate[] = payload.items ?? [];
      if (parsed.length === 0) {
        setError("No recognizable food items were found. Try listing foods with approximate amounts.");
        return;
      }
      setItems(
        parsed.map((item) => ({
          ...item,
          id: createItemId(),
          weightText: String(Math.round(item.estimatedWeightG)),
        })),
      );
      setProvider(payload.providerUsed);
    } catch {
      setError("Unable to reach Bitewise to analyze your description. Check your connection and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function updateItemName(id: string, foodName: string) {
    setItems((current) => current.map((entry) => (entry.id === id ? { ...entry, foodName } : entry)));
  }

  function updateItemWeight(id: string, rawText: string) {
    setItems((current) =>
      current.map((entry) => {
        if (entry.id !== id) return entry;
        const parsed = Number(rawText);
        const safeWeight = Number.isFinite(parsed) && parsed > 0 ? Math.min(100000, parsed) : entry.estimatedWeightG;
        return {
          ...entry,
          weightText: rawText,
          estimatedWeightG: safeWeight,
        };
      }),
    );
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((entry) => entry.id !== id));
  }

  async function saveAll() {
    if (items.some((item) => !item.foodName.trim())) {
      setError("Every item needs a food name before saving.");
      return;
    }
    setError(null);
    setStatus(null);
    setIsSaving(true);
    try {
      const response = await fetch("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          items.map((item) => ({
            logDate: getBrowserDate(),
            timezone: getBrowserTimezone(),
            mealType,
            foodName: item.foodName.trim(),
            weightG: item.estimatedWeightG,
            nutrientRate: item.nutrientRate,
            source: "ai_text",
            dataSource: provider,
            aiConfidence: item.confidence,
          })),
        ),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to save these food logs.");
        return;
      }
      setStatus(`Saved ${payload.logs?.length ?? items.length} food items (${Math.round(totalCalories)} kcal) to today's journal.`);
      setItems([]);
      setDescription("");
    } catch {
      setError("Unable to save these food logs. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="text-meal-description">
          Describe your meal
        </label>
        <textarea
          id="text-meal-description"
          className="mt-2 min-h-28 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] p-3 text-sm outline-none focus:border-[var(--leaf)]"
          placeholder="Example: two scrambled eggs, two slices of whole wheat toast, and a banana"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <button
        className="active-press h-11 w-full rounded-xl bg-[var(--leaf)] font-semibold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:opacity-50"
        disabled={isAnalyzing || isSaving || description.trim().length < 3}
        onClick={() => void analyze()}
        type="button"
      >
        {isAnalyzing ? "Parsing meal..." : "Review estimate"}
      </button>

      {error && <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] p-4 text-xs font-semibold text-[var(--coral)]" role="alert">{error}</p>}

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

      {items.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[var(--foreground)]">Review parsed foods</h2>
            <span className="rounded-full bg-[var(--leaf-light)] px-3 py-1 text-xs font-semibold text-[var(--leaf-ink)]">
              AI estimate · {provider}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]" htmlFor="text-meal-slot">
              Meal
            </label>
            <select
              id="text-meal-slot"
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

          <div className="space-y-3">
            {items.map((item, index) => {
              const totals = computeNutrients(item.estimatedWeightG, item.nutrientRate);
              return (
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4" key={item.id}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="tabular-nums text-xs font-bold text-[var(--leaf)]">
                      {Math.round(totals.calories)} kcal · Confidence: {item.confidence}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={isSaving}
                      aria-label={`Remove ${item.foodName || `item ${index + 1}`}`}
                      className="active-press inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--coral)] hover:bg-[var(--coral-soft)] disabled:opacity-50"
                    >
                      <IconX className="size-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink-muted)]" htmlFor={`text-name-${item.id}`}>
                        Food name
                      </label>
                      <input
                        id={`text-name-${item.id}`}
                        className="mt-1 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 text-sm font-semibold outline-none focus:border-[var(--leaf)]"
                        disabled={isSaving}
                        maxLength={200}
                        value={item.foodName}
                        onChange={(event) => updateItemName(item.id, event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink-muted)]" htmlFor={`text-weight-${item.id}`}>
                        Weight (g)
                      </label>
                      <input
                        id={`text-weight-${item.id}`}
                        className="tabular-nums mt-1 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 text-sm font-bold outline-none focus:border-[var(--leaf)]"
                        disabled={isSaving}
                        min="1"
                        max="100000"
                        type="number"
                        inputMode="numeric"
                        value={item.weightText}
                        onChange={(event) => updateItemWeight(item.id, event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm">
            <span className="font-semibold text-[var(--ink-muted)]">Estimated meal total ({items.length} items)</span>
            <strong className="tabular-nums text-base font-extrabold text-[var(--foreground)]">
              {Math.round(totalCalories).toLocaleString()} kcal
            </strong>
          </div>

          <button
            className="active-press h-12 w-full rounded-xl bg-[var(--leaf)] text-sm font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:opacity-50"
            disabled={isSaving || items.some((item) => !item.foodName.trim())}
            onClick={() => void saveAll()}
            type="button"
          >
            {isSaving ? "Saving..." : `Save all ${items.length} food items to journal`}
          </button>
        </div>
      )}
    </div>
  );
}
