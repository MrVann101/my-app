"use client";

import { useState } from "react";
import { computeNutrients } from "@/lib/food";
import type { AiTextEstimate } from "@/lib/types";

export default function PhotoFoodForm() {
  const [items, setItems] = useState<AiTextEstimate[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setError(null);
    setItems([]);
    setIsAnalyzing(true);
    const body = new FormData();
    body.set("image", file);
    const response = await fetch("/api/food/analyze-photo", { method: "POST", body });
    const payload = await response.json();
    setIsAnalyzing(false);
    if (!response.ok) {
      setError(payload.error?.message ?? "Photo analysis is unavailable. Use search or manual entry instead.");
      return;
    }
    setItems(payload.items);
    setProvider(payload.providerUsed);
  }

  function updateWeight(index: number, weight: number) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, estimatedWeightG: Math.max(1, weight || 1) } : item));
  }

  return <div className="space-y-5"><label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-muted)] p-5 text-center hover:border-[var(--leaf)]"><span className="font-semibold">{isAnalyzing ? "Analyzing your meal..." : "Take or upload a food photo"}</span><span className="mt-2 text-xs text-[var(--ink-muted)]">JPEG, PNG, or WebP · up to 10 MB</span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => handleImage(event.target.files?.[0])} /></label>{error && <p className="rounded-xl bg-[#fff0eb] p-4 text-sm leading-5 text-[var(--coral)]" role="alert">{error}</p>}{items.length > 0 && <div className="space-y-3"><div className="flex items-center justify-between"><p className="font-semibold">Review AI estimate</p><span className="rounded-full bg-[#eef7ee] px-3 py-1 text-xs font-medium text-[var(--leaf-deep)]">AI estimate · {provider}</span></div>{items.map((item, index) => { const totals = computeNutrients(item.estimatedWeightG, item.nutrientRate); return <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4" key={`${item.foodName}-${index}`}><div className="flex items-start justify-between"><div><p className="font-semibold">{item.foodName}</p><p className="mt-1 text-xs text-[var(--ink-muted)]">Confidence: {item.confidence} · {item.nutrientRate.caloriesPerG.toFixed(2)} cal/g</p></div><span className="text-sm font-semibold">{Math.round(totals.calories)} kcal</span></div><label className="mt-4 block text-sm font-medium">Weight (g)<input className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3" min="1" max="100000" type="number" value={item.estimatedWeightG} onChange={(event) => updateWeight(index, Number(event.target.value))} /></label><p className="mt-2 text-xs text-[var(--ink-muted)]">Calories and macros recalculate from weight. They are not directly editable.</p></div>; })}<p className="text-xs leading-5 text-[var(--ink-muted)]">Review each item before saving. AI nutrition values are estimates, not medical advice.</p></div>}</div>;
}
