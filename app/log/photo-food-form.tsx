"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { computeNutrients } from "@/lib/food";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";
import type { AiPhotoEstimate } from "@/lib/types";
import { IconCamera, IconUpload } from "@/components/icons";

export default function PhotoFoodForm() {
  const [items, setItems] = useState<AiPhotoEstimate[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mealType, setMealType] = useState("snack");

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function openFilePicker(target: "camera" | "gallery") {
    setError(null);
    setStatus(null);
    if (target === "camera") {
      cameraInputRef.current?.click();
    } else if (target === "gallery") {
      galleryInputRef.current?.click();
    }
  }

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setError(null);
    setAuthRequired(false);
    setStatus(null);
    setItems([]);
    setProvider(null);

    // Set local image thumbnail preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    setIsAnalyzing(true);
    const body = new FormData();
    body.set("image", file);
    try {
      const response = await fetch("/api/food/analyze-photo", { method: "POST", body });
      const payload = await response.json();
      setIsAnalyzing(false);
      if (!response.ok) {
        if (response.status === 401) {
          setAuthRequired(true);
          setError("Sign in to analyze meal photos.");
          return;
        }
        setError(payload.error?.message ?? "Photo analysis is unavailable. Use search or manual entry instead.");
        return;
      }
      if (!payload.items?.length) {
        setError("No food items were found in this photo. Try another image or enter the meal manually.");
        return;
      }
      setItems(payload.items);
      setProvider(payload.providerUsed);
    } catch {
      setIsAnalyzing(false);
      setError("Unable to complete photo analysis.");
    }
  }

  function updateFoodName(index: number, foodName: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, foodName } : item));
  }

  function updateCalories(index: number, calories: number) {
    setItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const safeTotal = Number.isFinite(calories) ? Math.max(0, calories) : 0;
      return {
        ...item,
        nutrientRate: { ...item.nutrientRate, caloriesPerG: safeTotal / item.estimatedWeightG },
      };
    }));
  }

  function addIngredient() {
    setItems((current) => [...current, {
      foodName: "",
      estimatedWeightG: 100,
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
    }]);
  }

  function removeIngredient(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function saveItems(targetItems: AiPhotoEstimate[]) {
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
        body: JSON.stringify(targetItems.map((item) => ({
            logDate,
            timezone: getBrowserTimezone(),
            mealType,
            foodName: item.foodName,
            weightG: item.estimatedWeightG,
            nutrientRate: item.nutrientRate,
            source: "ai_photo",
            dataSource: provider,
            aiConfidence: item.confidence,
          }))),
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

      const savedCalories = targetItems.reduce(
        (total, item) => total + computeNutrients(item.estimatedWeightG, item.nutrientRate).calories,
        0,
      );
      setItems([]);
      setPreviewUrl(null);
      setStatus(`Saved ${targetItems.length} food items (${Math.round(savedCalories)} kcal) to today's journal. Calories remaining updated.`);
    } catch {
      setError("Unable to save these food logs. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Hidden File Inputs */}
      <input
        ref={cameraInputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(event) => handleImage(event.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => handleImage(event.target.files?.[0])}
      />

      <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => openFilePicker("camera")}
            disabled={isAnalyzing}
            className="active-press flex flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center shadow-xs transition-all hover:border-[var(--leaf)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-[var(--leaf-light)] text-[var(--leaf)]">
              <IconCamera className="size-6" />
            </div>
            <strong className="mt-3 text-sm font-bold text-[var(--foreground)]">Take Photo with Camera</strong>
            <span className="mt-1 text-xs text-[var(--ink-muted)]">Opens live camera capture</span>
          </button>

          <button
            type="button"
            onClick={() => openFilePicker("gallery")}
            disabled={isAnalyzing}
            className="active-press flex flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center shadow-xs transition-all hover:border-[var(--leaf)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-[var(--leaf-light)] text-[var(--leaf)]">
              <IconUpload className="size-6" />
            </div>
            <strong className="mt-3 text-sm font-bold text-[var(--foreground)]">Upload from Gallery</strong>
            <span className="mt-1 text-xs text-[var(--ink-muted)]">Choose JPEG, PNG, or WebP</span>
          </button>
      </div>
      <p className="text-xs leading-5 text-[var(--ink-muted)]">
        Photos are analyzed securely and automatically deleted after 30 days.
      </p>

      {/* Image Thumbnail Preview & Loading State */}
      {previewUrl && (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Meal preview" className="size-20 rounded-xl object-cover border border-[var(--line)]" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--leaf)]">Selected Image</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {isAnalyzing ? "Analyzing meal composition..." : "Photo loaded ready for review"}
            </p>
            {isAnalyzing && <p className="mt-1 text-xs text-[var(--ink-muted)] animate-pulse">Running AI vision model...</p>}
          </div>
        </div>
      )}

      {error && (
        <div aria-live="polite" className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/10 p-4 text-xs font-bold text-[var(--coral)]" role="alert">
          {error}{authRequired && <> <Link className="underline underline-offset-2" href="/login">Sign in</Link> and reopen Photo AI.</>}
        </div>
      )}

      {status && (
        <p aria-live="polite" className="rounded-xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-4 text-xs font-bold text-[var(--leaf-ink)]" role="status">
          {status}
        </p>
      )}

      {/* Editable AI nutrition cards */}
      {items.length > 0 && (
        <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)]">Review Food Estimates</h3>
              <p className="text-xs text-[var(--ink-muted)]">Review each ingredient, adjust its calories, or add an ingredient the AI missed.</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="rounded-full bg-[var(--leaf-light)] px-3 py-1 text-xs font-bold text-[var(--leaf)] uppercase">
                AI Vision · {provider}
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={addIngredient}
              disabled={isSaving}
              aria-label="Add ingredient"
              className="active-press min-h-10 min-w-20 rounded-lg border border-[var(--leaf)]/40 bg-[var(--leaf-light)] px-4 py-2 text-sm font-bold text-[var(--leaf-ink)] hover:bg-[var(--leaf)]/15 disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]">
            Meal Event
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
          </label>

          <div className="space-y-3">
            {items.map((item, index) => {
              const totals = computeNutrients(item.estimatedWeightG, item.nutrientRate);
              return (
                <div className="relative rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4" key={`${item.foodName}-${index}`}>
                  <div className="absolute right-3 top-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeIngredient(index)}
                      disabled={isSaving}
                      aria-label={`Remove ${item.foodName || "ingredient"}`}
                      className="active-press px-1 text-lg font-semibold leading-none text-[var(--coral)] hover:text-[var(--coral)]/70 disabled:opacity-50"
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-[var(--ink-muted)]">
                      Ingredient
                      <input
                        className="mt-1 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--foreground)] outline-none focus:border-[var(--leaf)]"
                        maxLength={200}
                        placeholder="e.g. oil, sauce, dressing"
                        value={item.foodName}
                        onChange={(event) => updateFoodName(index, event.target.value)}
                      />
                    </label>
                    <div className="block text-xs font-semibold text-[var(--ink-muted)]">
                      <label htmlFor={`ingredient-calories-${index}`}>Calories (kcal)</label>
                      <input
                        id={`ingredient-calories-${index}`}
                        className="tabular-nums mt-1 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--foreground)] outline-none focus:border-[var(--leaf)]"
                        min="0"
                        step="1"
                        type="number"
                        value={totals.calories}
                        onChange={(event) => updateCalories(index, Number(event.target.value))}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void saveItems(items)}
            disabled={isSaving || items.some((item) => !item.foodName.trim())}
            className="active-press h-11 w-full rounded-xl bg-[var(--leaf-deep)] text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : `Save all ${items.length} food items to journal`}
          </button>
        </div>
      )}
    </div>
  );
}
