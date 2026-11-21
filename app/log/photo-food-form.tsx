"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { computeNutrients } from "@/lib/food";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";
import { defaultMealTypeByHour, MEAL_SLOTS, normalizeMealSlot, type MealSlot } from "@/lib/meal-slot";
import type { AiPhotoEstimate } from "@/lib/types";
import { IconCamera, IconUpload, IconX } from "@/components/icons";

type EditablePhotoItem = AiPhotoEstimate & {
  id: string;
  caloriesText: string;
};

function createItemId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toEditableItems(items: AiPhotoEstimate[]): EditablePhotoItem[] {
  return items.map((item) => {
    const kcal = Math.round(computeNutrients(item.estimatedWeightG, item.nutrientRate).calories);
    return {
      ...item,
      id: createItemId(),
      caloriesText: String(kcal),
    };
  });
}

export default function PhotoFoodForm({ initialMealType }: { initialMealType?: string } = {}) {
  const [items, setItems] = useState<EditablePhotoItem[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [mealType, setMealType] = useState<MealSlot>(() => normalizeMealSlot(initialMealType) ?? "snack");
  const userChangedSlot = useRef(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const totalMealCalories = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + computeNutrients(item.estimatedWeightG, item.nutrientRate).calories,
        0,
      ),
    [items],
  );

  function openFilePicker(target: "camera" | "gallery") {
    setError(null);
    setStatus(null);
    if (target === "camera") {
      cameraInputRef.current?.click();
    } else {
      galleryInputRef.current?.click();
    }
  }

  async function analyzeFile(file: File) {
    setError(null);
    setAuthRequired(false);
    setStatus(null);
    setItems([]);
    setProvider(null);
    setLastFile(file);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setIsAnalyzing(true);

    const body = new FormData();
    body.set("image", file);
    try {
      const response = await fetch("/api/food/analyze-photo", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          setAuthRequired(true);
          setError("Sign in to analyze meal photos.");
          return;
        }
        setError(payload.error?.message ?? "Photo analysis is unavailable. Use Search or Text AI instead.");
        return;
      }
      if (!payload.items?.length) {
        setError("No food items were found in this photo. Try another image or enter the meal manually.");
        return;
      }
      setItems(toEditableItems(payload.items));
      setProvider(payload.providerUsed);
    } catch {
      setError("Unable to complete photo analysis. Check your connection and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      void analyzeFile(file);
    }
  }

  function updateFoodName(id: string, foodName: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, foodName } : item)));
  }

  function updateCalories(id: string, rawText: string) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const parsed = rawText.trim() === "" ? 0 : Number(rawText);
        const safeTotal = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
        const previousTotal = computeNutrients(item.estimatedWeightG, item.nutrientRate).calories;
        const scale = previousTotal > 0 ? safeTotal / previousTotal : null;

        return {
          ...item,
          caloriesText: rawText,
          nutrientRate: {
            ...item.nutrientRate,
            caloriesPerG: safeTotal / item.estimatedWeightG,
            proteinPerG: scale !== null ? item.nutrientRate.proteinPerG * scale : item.nutrientRate.proteinPerG,
            carbsPerG: scale !== null ? item.nutrientRate.carbsPerG * scale : item.nutrientRate.carbsPerG,
            fatPerG: scale !== null ? item.nutrientRate.fatPerG * scale : item.nutrientRate.fatPerG,
          },
        };
      }),
    );
  }

  function addIngredient() {
    setItems((current) => [
      ...current,
      {
        id: createItemId(),
        foodName: "",
        estimatedWeightG: 100,
        caloriesText: "0",
        nutrientRate: {
          caloriesPerG: 0,
          proteinPerG: 0,
          carbsPerG: 0,
          fatPerG: 0,
          fiberPerG: 0,
          sodiumPerG: 0,
          sugarPerG: 0,
        },
        confidence: "low",
      },
    ]);
  }

  function removeIngredient(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  async function saveItems(targetItems: EditablePhotoItem[]) {
    if (targetItems.some((item) => !item.foodName.trim())) {
      setError("Add a food name before saving.");
      return;
    }
    setError(null);
    setStatus(null);
    setIsSaving(true);
    const logDate = getBrowserDate();
    try {
      const response = await fetch("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          targetItems.map((item) => ({
            logDate,
            timezone: getBrowserTimezone(),
            mealType,
            foodName: item.foodName,
            weightG: item.estimatedWeightG,
            nutrientRate: item.nutrientRate,
            source: "ai_photo",
            dataSource: provider,
            aiConfidence: item.confidence,
          })),
        ),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          setAuthRequired(true);
          setError("Your session expired. Sign in again to save these foods.");
        } else {
          setError(payload.error?.message ?? "Unable to save these food logs.");
        }
        return;
      }

      setItems([]);
      setPreviewUrl(null);
      setLastFile(null);
      setStatus(`Saved ${targetItems.length} food items (${Math.round(totalMealCalories)} kcal) to today's journal.`);
    } catch {
      setError("Unable to save these food logs. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <input
        ref={cameraInputRef}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => openFilePicker("camera")}
          disabled={isAnalyzing}
          className="active-press flex min-h-11 flex-col items-center justify-center rounded-2xl border border-[var(--border-control)] bg-[var(--surface)] p-6 text-center shadow-xs transition-colors hover:border-[var(--leaf)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
        >
          <div className="grid size-12 place-items-center rounded-2xl bg-[var(--leaf-light)] text-[var(--leaf-ink)]">
            <IconCamera className="size-6" />
          </div>
          <strong className="mt-3 text-sm font-bold text-[var(--foreground)]">Take Photo with Camera</strong>
          <span className="mt-1 text-xs text-[var(--ink-muted)]">Opens live camera capture</span>
        </button>

        <button
          type="button"
          onClick={() => openFilePicker("gallery")}
          disabled={isAnalyzing}
          className="active-press flex min-h-11 flex-col items-center justify-center rounded-2xl border border-[var(--border-control)] bg-[var(--surface)] p-6 text-center shadow-xs transition-colors hover:border-[var(--leaf)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
        >
          <div className="grid size-12 place-items-center rounded-2xl bg-[var(--leaf-light)] text-[var(--leaf-ink)]">
            <IconUpload className="size-6" />
          </div>
          <strong className="mt-3 text-sm font-bold text-[var(--foreground)]">Upload from Gallery</strong>
          <span className="mt-1 text-xs text-[var(--ink-muted)]">Choose JPEG, PNG, or WebP</span>
        </button>
      </div>

      <p className="text-xs leading-5 text-[var(--ink-muted)]">
        Includes up to 2 AI photo analyses per day. Photos are analyzed securely and automatically deleted after 30 days.
      </p>

      {previewUrl && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Meal preview" className="size-20 rounded-xl border border-[var(--line)] object-cover" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--leaf)]">Selected Image</p>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {isAnalyzing ? "Analyzing meal composition..." : items.length > 0 ? "Photo analyzed — review below" : "Photo ready"}
              </p>
              {isAnalyzing && <p className="mt-1 animate-pulse text-xs text-[var(--ink-muted)]">Running AI vision model...</p>}
            </div>
          </div>
          {!isAnalyzing && lastFile && items.length === 0 && (
            <button
              type="button"
              onClick={() => void analyzeFile(lastFile)}
              className="active-press min-h-11 rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] px-4 text-xs font-bold text-[var(--foreground)] hover:border-[var(--leaf)]"
            >
              Retry analysis
            </button>
          )}
        </div>
      )}

      {error && (
        <div aria-live="polite" className="space-y-2 rounded-xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] p-4 text-xs font-bold text-[var(--coral)]" role="alert">
          <p>
            {error}
            {authRequired && (
              <>
                {" "}
                <Link className="underline underline-offset-2" href="/login">Sign in</Link> and reopen Photo AI.
              </>
            )}
          </p>
          {!authRequired && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/log?tab=search" className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border-control)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--foreground)]">
                Search Database
              </Link>
              <Link href="/log?tab=text" className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border-control)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--foreground)]">
                Try Text AI
              </Link>
            </div>
          )}
        </div>
      )}

      {status && (
        <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-4 text-xs font-bold text-[var(--leaf-ink)]" role="status">
          <span>{status}</span>
          <Link href="/dashboard" className="underline underline-offset-2 hover:opacity-80">
            View Dashboard →
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
            <div>
              <h2 className="text-base font-bold text-[var(--foreground)]">Review Food Estimates</h2>
              <p className="text-xs text-[var(--ink-muted)]">Edit any ingredient name, adjust calories, or add items the AI missed.</p>
            </div>
            <span className="rounded-full bg-[var(--leaf-light)] px-3 py-1 text-xs font-bold uppercase text-[var(--leaf-ink)]">
              AI Vision · {provider}
            </span>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-[180px] flex-1">
              <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]" htmlFor="photo-meal-slot">
                Meal
              </label>
              <select
                id="photo-meal-slot"
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

            <button
              type="button"
              onClick={addIngredient}
              disabled={isSaving}
              className="active-press min-h-11 rounded-xl border border-[var(--leaf)]/40 bg-[var(--leaf-light)] px-4 text-xs font-bold text-[var(--leaf-ink)] hover:opacity-90 disabled:opacity-50"
            >
              + Add ingredient
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4" key={item.id}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                    Item {index + 1} · ~{Math.round(item.estimatedWeightG)}g
                  </span>
                  <button
                    type="button"
                    onClick={() => removeIngredient(item.id)}
                    disabled={isSaving}
                    aria-label={`Remove ${item.foodName || `item ${index + 1}`}`}
                    className="active-press inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--coral)] hover:bg-[var(--coral-soft)] disabled:opacity-50"
                  >
                    <IconX className="size-4" />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--ink-muted)]" htmlFor={`photo-name-${item.id}`}>
                      Ingredient
                    </label>
                    <input
                      id={`photo-name-${item.id}`}
                      className="mt-1 h-11 w-full rounded-lg border border-[var(--border-control)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--foreground)] outline-none focus:border-[var(--leaf)]"
                      maxLength={200}
                      placeholder="e.g. grilled chicken, olive oil"
                      value={item.foodName}
                      onChange={(event) => updateFoodName(item.id, event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--ink-muted)]" htmlFor={`photo-kcal-${item.id}`}>
                      Calories (kcal)
                    </label>
                    <input
                      id={`photo-kcal-${item.id}`}
                      className="tabular-nums mt-1 h-11 w-full rounded-lg border border-[var(--border-control)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--foreground)] outline-none focus:border-[var(--leaf)]"
                      min="0"
                      step="1"
                      type="number"
                      inputMode="numeric"
                      value={item.caloriesText}
                      onChange={(event) => updateCalories(item.id, event.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm">
            <span className="font-semibold text-[var(--ink-muted)]">Estimated meal total ({items.length} items)</span>
            <strong className="tabular-nums text-base font-extrabold text-[var(--foreground)]">
              {Math.round(totalMealCalories).toLocaleString()} kcal
            </strong>
          </div>

          <button
            type="button"
            onClick={() => void saveItems(items)}
            disabled={isSaving || items.some((item) => !item.foodName.trim())}
            className="active-press h-12 w-full rounded-xl bg-[var(--leaf)] text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : `Save all ${items.length} food items to journal`}
          </button>
        </div>
      )}
    </div>
  );
}
