"use client";

import { useState } from "react";
import FoodSearch, { type SearchResult } from "@/app/log/food-search";
import type { NutrientRate } from "@/lib/types";

type PlanItem = { foodName: string; weightG: number; nutrientRate: NutrientRate };

const PLAN_AVATARS = ["🥗", "🍗", "🍳", "🥩", "🍱", "🥑", "🥞", "🍲", "🥪", "🥣"];

export default function PlanBuilder({ onPlanCreated }: { onPlanCreated?: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"private" | "public">("private");

  const [items, setItems] = useState<PlanItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        setError("Cover image file size should be less than 3MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  function handleAddSearchResult(result: SearchResult) {
    const newItem: PlanItem = {
      foodName: result.foodName,
      weightG: result.defaultWeightG || 100,
      nutrientRate: result.nutrientRate,
    };
    setItems((prev) => [...prev, newItem]);
  }

  function updateItemWeight(index: number, newWeight: number) {
    const validWeight = Math.max(1, Math.min(10000, newWeight));
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, weightG: validWeight } : item))
    );
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  async function savePlan() {
    if (!name || items.length === 0) return;
    setError(null);
    setIsSaving(true);

    const planName = name.trim();

    const response = await fetch("/api/meal-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: planName,
        visibility,
        goal: null,
        dietType: null,
        items,
      }),
    });

    const payload = await response.json();
    setIsSaving(false);

    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to save meal plan.");
      return;
    }

    if (coverImage && typeof window !== "undefined") {
      try {
        localStorage.setItem(`bitewise_plan_cover_${payload.plan.id}`, coverImage);
      } catch {}
    }

    setMessage(`✓ Created meal plan template "${payload.plan.name}"!`);
    setName("");
    setCoverImage(null);
    setItems([]);
    setStep(1);
    onPlanCreated?.();
  }

  const totals = items.reduce(
    (acc, item) => {
      acc.calories += item.weightG * (item.nutrientRate.caloriesPerG || 0);
      acc.protein += item.weightG * (item.nutrientRate.proteinPerG || 0);
      acc.carbs += item.weightG * (item.nutrientRate.carbsPerG || 0);
      acc.fat += item.weightG * (item.nutrientRate.fatPerG || 0);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Wizard Step Progress Header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={`flex size-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                step === s
                  ? "bg-[var(--leaf)] text-white shadow-2xs"
                  : step > s
                  ? "bg-[var(--leaf-light)] text-[var(--leaf-deep)]"
                  : "bg-[var(--surface-muted)] text-[var(--ink-muted)]"
              }`}
            >
              {s}
            </span>
          ))}
          <span className="ml-2 text-xs font-bold text-[var(--foreground)]">
            {step === 1 ? "Step 1: Name & Cover Image" : step === 2 ? "Step 2: Search & Add Foods" : "Step 3: Private vs. Public"}
          </span>
        </div>

        <span className="tabular-nums text-xs font-bold text-[var(--leaf)]">
          {Math.round(totals.calories)} kcal total
        </span>
      </div>

      {error && <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/10 p-4 text-xs font-bold text-[var(--coral)]" role="alert">{error}</p>}
      {message && <p className="rounded-xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-4 text-xs font-bold text-[var(--leaf-deep)]" role="status">{message}</p>}

      {/* STEP 1: Name & Optional Cover Image */}
      {step === 1 && (
        <div className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs">
          <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]">
            Meal Plan Name
            <input
              className="mt-1.5 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-semibold outline-none focus:border-[var(--leaf)]"
              placeholder="e.g. High Protein Prep, Keto Lunch Pack..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <div>
            <label className="block text-xs font-bold uppercase text-[var(--ink-muted)] mb-2">
              Plan Cover Image <span className="text-[var(--ink-muted)] font-normal text-[10px]">(Optional)</span>
            </label>
            {coverImage ? (
              <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverImage} alt="Plan cover" className="h-36 w-full rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverImage(null)}
                  className="mt-2 text-xs font-bold text-[var(--coral)] hover:underline"
                >
                  ✕ Remove Cover Image
                </button>
              </div>
            ) : (
              <label className="active-press flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--surface-muted)] p-6 text-center transition-colors hover:border-[var(--leaf)] hover:bg-[var(--leaf-soft)]/20">
                <svg className="size-8 text-[var(--leaf)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="mt-2 text-xs font-bold text-[var(--foreground)]">Click to upload cover image</span>
                <span className="mt-0.5 text-[10px] text-[var(--ink-muted)]">PNG, JPG, WebP up to 3MB</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => setStep(2)}
            className="active-press h-11 w-full rounded-xl bg-[var(--leaf)] text-xs font-bold text-white shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
          >
            Next: Search & Add Foods →
          </button>
        </div>
      )}

      {/* STEP 2: Icon Search & Add Items */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-5 space-y-3">
            <FoodSearch onSelect={() => {}} onAdd={handleAddSearchResult} />
          </div>

          {/* Current Items List & Live Macro Breakdown */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--foreground)]">Plan Items ({items.length})</h3>
              <span className="tabular-nums text-xs font-extrabold text-[var(--leaf)]">
                {Math.round(totals.calories)} kcal
              </span>
            </div>

            {/* Live Macro Breakdown */}
            <div className="grid grid-cols-4 gap-2 rounded-xl bg-[var(--surface-muted)] p-3 text-center">
              <div>
                <span className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">Calories</span>
                <strong className="tabular-nums block text-xs font-black text-[var(--foreground)]">{Math.round(totals.calories)}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">Protein</span>
                <strong className="tabular-nums block text-xs font-black text-[var(--leaf)]">{Math.round(totals.protein)}g</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">Carbs</span>
                <strong className="tabular-nums block text-xs font-black text-[var(--sky-deep)]">{Math.round(totals.carbs)}g</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">Fat</span>
                <strong className="tabular-nums block text-xs font-black text-[var(--sun)]">{Math.round(totals.fat)}g</strong>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--ink-muted)]">
                No items added yet. Search above and tap <strong>&quot;+ Add&quot;</strong> to build your plan.
              </p>
            ) : (
              <div className="divide-y divide-[var(--line)]/50">
                {items.map((item, idx) => (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2 text-xs" key={`${item.foodName}-${idx}`}>
                    <div>
                      <strong className="font-bold text-[var(--foreground)] text-sm">{item.foodName}</strong>
                      <span className="ml-2 tabular-nums font-semibold text-[var(--leaf)]">
                        {Math.round(item.weightG * item.nutrientRate.caloriesPerG)} kcal
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-1">
                        <button
                          type="button"
                          onClick={() => updateItemWeight(idx, item.weightG - 10)}
                          className="h-7 w-7 rounded-md bg-[var(--surface)] text-xs font-bold text-[var(--foreground)] hover:bg-[var(--line)]"
                        >
                          -10
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          value={item.weightG}
                          onChange={(e) => updateItemWeight(idx, Number(e.target.value))}
                          className="w-14 text-center text-xs font-bold bg-transparent outline-none tabular-nums"
                        />
                        <span className="text-[10px] text-[var(--ink-muted)] mr-1">g</span>
                        <button
                          type="button"
                          onClick={() => updateItemWeight(idx, item.weightG + 10)}
                          className="h-7 w-7 rounded-md bg-[var(--surface)] text-xs font-bold text-[var(--foreground)] hover:bg-[var(--line)]"
                        >
                          +10
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItemWeight(idx, item.weightG + 50)}
                          className="h-7 w-7 rounded-md bg-[var(--surface)] text-xs font-bold text-[var(--foreground)] hover:bg-[var(--line)]"
                        >
                          +50
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="ml-1 text-xs font-bold text-[var(--coral)] hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="active-press h-11 flex-1 rounded-xl border border-[var(--line)] text-xs font-bold text-[var(--ink-muted)] hover:bg-[var(--surface-muted)]"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={items.length === 0}
                onClick={() => setStep(3)}
                className="active-press h-11 flex-2 rounded-xl bg-[var(--leaf)] text-xs font-bold text-white shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
              >
                Done: Set Visibility →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Private vs Public Choice */}
      {step === 3 && (
        <div className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs">
          <h3 className="text-sm font-bold text-[var(--foreground)]">Choose Plan Visibility</h3>
          <p className="text-xs text-[var(--ink-muted)]">
            Decide whether to keep this meal plan private to your account or share it publicly with the community.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setVisibility("private")}
              className={`active-press p-4 rounded-2xl border text-left transition-all ${
                visibility === "private"
                  ? "border-[var(--leaf)] bg-[var(--leaf-light)] text-[var(--leaf-deep)] shadow-2xs"
                  : "border-[var(--line)] bg-[var(--surface-muted)]"
              }`}
            >
              <strong className="block text-sm font-bold">🔒 Only Me (Private)</strong>
              <span className="mt-1 block text-xs text-[var(--ink-muted)]">Visible only in your private My Plans dashboard.</span>
            </button>

            <button
              type="button"
              onClick={() => setVisibility("public")}
              className={`active-press p-4 rounded-2xl border text-left transition-all ${
                visibility === "public"
                  ? "border-[var(--leaf)] bg-[var(--leaf-light)] text-[var(--leaf-deep)] shadow-2xs"
                  : "border-[var(--line)] bg-[var(--surface-muted)]"
              }`}
            >
              <strong className="block text-sm font-bold">🌐 Public (Community)</strong>
              <span className="mt-1 block text-xs text-[var(--ink-muted)]">Others can browse and fork a private copy.</span>
            </button>
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="active-press h-12 flex-1 rounded-xl border border-[var(--line)] text-xs font-bold text-[var(--ink-muted)] hover:bg-[var(--surface-muted)]"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void savePlan()}
              className="active-press h-12 flex-2 rounded-xl bg-[var(--leaf)] text-sm font-bold text-white shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
            >
              {isSaving ? "Saving Plan..." : `✓ Save "${name}" Template`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
