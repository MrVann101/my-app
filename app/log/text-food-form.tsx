"use client";

import { useState } from "react";
import { computeNutrients } from "@/lib/food";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";
import type { AiTextEstimate } from "@/lib/types";

export default function TextFoodForm() {
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<AiTextEstimate[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mealType, setMealType] = useState("snack");

  async function analyze() {
    setError(null);
    setStatus(null);
    setIsAnalyzing(true);
    const response = await fetch("/api/food/analyze-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description }) });
    const payload = await response.json();
    setIsAnalyzing(false);
    if (!response.ok) {
      setError(payload.error?.message ?? "Description analysis failed. Use search or manual entry instead.");
      return;
    }
    setItems(payload.items);
    setProvider(payload.providerUsed);
  }

  async function saveAll() {
    setError(null);
    setStatus(null);
    setIsSaving(true);
    let savedCount = 0;
    try {
      for (const item of items) {
        const response = await fetch("/api/food/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            logDate: getBrowserDate(),
            timezone: getBrowserTimezone(),
            mealType,
            foodName: item.foodName,
            weightG: item.estimatedWeightG,
            nutrientRate: item.nutrientRate,
            source: "ai_text",
            dataSource: provider,
            aiConfidence: item.confidence,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error?.message ?? "Unable to save these food logs.");
          if (savedCount > 0) setStatus(`Saved ${savedCount} of ${items.length} food items. Retry the remaining items.`);
          return;
        }

        savedCount += 1;
        setItems((current) => current.filter((currentItem) => currentItem !== item));
      }
      setStatus(`Saved ${savedCount} food items to today's journal.`);
    } catch {
      setError("Unable to save these food logs. Check your connection and try again.");
      if (savedCount > 0) setStatus(`Saved ${savedCount} of ${items.length} food items. Retry the remaining items.`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">
        Describe your meal
        <textarea
          className="mt-2 min-h-28 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] p-3 outline-none focus:border-[var(--leaf)]"
          placeholder="Example: two eggs, toast, and a banana"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <button
        className="h-11 w-full rounded-xl bg-[var(--leaf)] font-semibold text-white disabled:opacity-50"
        disabled={isAnalyzing || isSaving || description.trim().length < 3}
        onClick={analyze}
        type="button"
      >
        {isAnalyzing ? "Parsing meal..." : "Review estimate"}
      </button>
      {error && <p className="rounded-xl bg-[#fff0eb] p-4 text-sm text-[var(--coral)]" role="alert">{error}</p>}
      {status && <p className="rounded-xl bg-[var(--leaf-light)] p-4 text-sm text-[var(--leaf-deep)]" role="status">{status}</p>}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Review parsed foods</p>
            <span className="rounded-full bg-[#eef7ee] px-3 py-1 text-xs text-[var(--leaf-deep)]">AI estimate · {provider}</span>
          </div>
          <label className="block text-sm font-medium">
            Meal Event
            <select
              className="mt-2 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3"
              value={mealType}
              onChange={(event) => setMealType(event.target.value)}
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </label>
          {items.map((item, index) => {
            const totals = computeNutrients(item.estimatedWeightG, item.nutrientRate);
            return (
              <div className="rounded-2xl border border-[var(--line)] p-4" key={`${item.foodName}-${index}`}>
                <div className="flex justify-between">
                  <span className="font-semibold">{item.foodName}</span>
                  <span className="text-sm">{Math.round(totals.calories)} kcal</span>
                </div>
                <label className="mt-3 block text-sm font-medium">
                  Weight (g)
                  <input
                    className="mt-2 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3"
                    disabled={isSaving}
                    min="1"
                    type="number"
                    value={item.estimatedWeightG}
                    onChange={(event) => setItems((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, estimatedWeightG: Math.max(1, Number(event.target.value) || 1) } : entry))}
                  />
                </label>
                <p className="mt-2 text-xs text-[var(--ink-muted)]">Confidence: {item.confidence}. Totals recalculate from weight.</p>
              </div>
            );
          })}
          <button
            className="h-11 w-full rounded-xl bg-[var(--leaf-deep)] font-semibold text-white disabled:opacity-50"
            disabled={isSaving}
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
