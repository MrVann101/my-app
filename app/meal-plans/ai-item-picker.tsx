"use client";

import { ChangeEvent, useState } from "react";
import { computeNutrients } from "@/lib/food";
import type { AiTextEstimate, NutrientRate } from "@/lib/types";

type PlanItem = { foodName: string; weightG: number; nutrientRate: NutrientRate };

export default function AiItemPicker({ onSelect }: { onSelect: (item: PlanItem) => void }) {
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<AiTextEstimate[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyzeText() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/food/analyze-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description }) });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error?.message ?? "Text analysis failed.");
      return;
    }
    setItems(payload.items ?? []);
    setProvider(payload.providerUsed ?? null);
  }

  async function analyzePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    const body = new FormData();
    body.set("image", file);
    const response = await fetch("/api/food/analyze-photo", { method: "POST", body });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error?.message ?? "Photo analysis failed.");
      return;
    }
    setItems(payload.items ?? []);
    setProvider(payload.providerUsed ?? null);
  }

  return <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"><p className="font-semibold">Add from an AI estimate</p><div className="mt-3 flex gap-2"><input className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm" placeholder="Example: oats, berries, and yogurt" value={description} onChange={(event) => setDescription(event.target.value)} /><button className="h-10 rounded-xl bg-[var(--leaf)] px-3 text-sm font-semibold text-white disabled:opacity-50" disabled={loading || description.trim().length < 3} onClick={analyzeText} type="button">Analyze</button></div><label className="mt-3 inline-flex cursor-pointer items-center rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--leaf)]"><span>{loading ? "Analyzing..." : "Use photo"}</span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={analyzePhoto} /></label>{error && <p className="mt-3 text-sm text-[var(--coral)]" role="alert">{error}</p>}{items.length > 0 && <div className="mt-4 space-y-2"><p className="text-xs text-[var(--ink-muted)]">Review estimate from {provider}</p>{items.map((item, index) => { const totals = computeNutrients(item.estimatedWeightG, item.nutrientRate); return <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] p-3" key={`${item.foodName}-${index}`}><span className="min-w-0"><strong className="block truncate text-sm">{item.foodName}</strong><span className="text-xs text-[var(--ink-muted)]">{item.estimatedWeightG}g · {Math.round(totals.calories)} kcal</span></span><button className="shrink-0 rounded-lg bg-[var(--leaf)] px-3 py-2 text-xs font-semibold text-white" onClick={() => onSelect({ foodName: item.foodName, weightG: item.estimatedWeightG, nutrientRate: item.nutrientRate })} type="button">Add</button></div>; })}</div>}</div>;
}
