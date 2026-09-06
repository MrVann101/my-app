"use client";

import { FormEvent, useMemo, useState } from "react";
import { computeNutrients, getWeightWarning } from "@/lib/food";
import type { NutrientRate } from "@/lib/types";
import FoodSearch, { type SearchResult } from "./food-search";

const emptyRate: NutrientRate = { caloriesPerG: 0, proteinPerG: 0, carbsPerG: 0, fatPerG: 0, fiberPerG: 0, sodiumPerG: 0, sugarPerG: 0 };

export default function LogFoodForm() {
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [mode, setMode] = useState<"search" | "manual">("search");
  const [foodName, setFoodName] = useState("");
  const [weightG, setWeightG] = useState(100);
  const [mealType, setMealType] = useState("snack");
  const [rate, setRate] = useState<NutrientRate>(emptyRate);
  const [labelCalories, setLabelCalories] = useState(0);
  const [labelWeightG, setLabelWeightG] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const effectiveRate = useMemo(() => mode === "manual" ? { ...rate, caloriesPerG: labelWeightG > 0 ? labelCalories / labelWeightG : 0 } : rate, [labelCalories, labelWeightG, mode, rate]);
  const computed = useMemo(() => computeNutrients(weightG, effectiveRate), [effectiveRate, weightG]);
  const weightWarning = getWeightWarning(weightG);

  function chooseFood(result: SearchResult) {
    setSelected(result);
    setFoodName(result.foodName);
    setWeightG(result.defaultWeightG);
    setRate(result.nutrientRate);
    setSaved(null);
  }

  function switchMode(nextMode: "search" | "manual") {
    setMode(nextMode);
    setSelected(null);
    setFoodName("");
    setRate(emptyRate);
    setLabelCalories(0);
    setLabelWeightG(100);
    setSaved(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(null);
    const response = await fetch("/api/food/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logDate: new Date().toISOString().slice(0, 10), mealType, foodName, weightG, nutrientRate: effectiveRate, source: selected ? "database" : "manual", dataSource: selected?.dataSource ?? null, aiConfidence: null }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to save this food log.");
      return;
    }
    setSaved(`${foodName} added: ${Math.round(computed.calories)} kcal.`);
    setFoodName("");
    setSelected(null);
  }

  return <div className="space-y-6">
    <div className="flex rounded-xl bg-[var(--surface-muted)] p-1 text-sm font-medium"><button className={`flex-1 rounded-lg px-3 py-2 ${mode === "search" ? "bg-[var(--surface)]" : "text-[var(--ink-muted)]"}`} onClick={() => switchMode("search")} type="button">Database search</button><button className={`flex-1 rounded-lg px-3 py-2 ${mode === "manual" ? "bg-[var(--surface)]" : "text-[var(--ink-muted)]"}`} onClick={() => switchMode("manual")} type="button">Manual/custom</button></div>
    {mode === "search" ? <FoodSearch onSelect={chooseFood} /> : <div className="rounded-2xl bg-[var(--surface-muted)] p-4"><label className="block text-sm font-medium">Food name<input className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3" value={foodName} onChange={(event) => setFoodName(event.target.value)} required /></label><p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">Enter the calories and weight shown together on the label once. Bitewise derives the rate and recalculates future portions from weight.</p><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-xs font-medium">Label calories<input className="mt-1 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2" min="0" step="1" type="number" value={labelCalories} onChange={(event) => setLabelCalories(Number(event.target.value))} /></label><label className="text-xs font-medium">Label weight (g)<input className="mt-1 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2" min="1" step="1" type="number" value={labelWeightG} onChange={(event) => setLabelWeightG(Number(event.target.value))} /></label>{(["proteinPerG", "carbsPerG", "fatPerG"] as const).map((key) => <label className="text-xs font-medium" key={key}>{key.replace("PerG", " / g")}<input className="mt-1 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2" min="0" step="0.001" type="number" value={rate[key]} onChange={(event) => setRate({ ...rate, [key]: Number(event.target.value) })} /></label>)}</div></div>}
    <form className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4" onSubmit={handleSubmit}><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Portion weight (g)<input className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3" min="1" max="100000" step="1" type="number" value={weightG} onChange={(event) => setWeightG(Number(event.target.value))} required />{weightWarning && <span className="mt-2 block text-xs font-normal text-[var(--sun)]">{weightWarning}</span>}</label><label className="text-sm font-medium">Meal<select className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3" value={mealType} onChange={(event) => setMealType(event.target.value)}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></label></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-[var(--surface-muted)] p-3"><strong className="block text-base">{Math.round(computed.calories)}</strong>kcal</div><div className="rounded-xl bg-[var(--surface-muted)] p-3"><strong className="block text-base">{Math.round(computed.proteinG)}g</strong>protein</div><div className="rounded-xl bg-[var(--surface-muted)] p-3"><strong className="block text-base">{effectiveRate.caloriesPerG.toFixed(2)}</strong>cal/g</div></div>{error && <p className="mt-4 text-sm text-[var(--coral)]" role="alert">{error}</p>}{saved && <p className="mt-4 text-sm text-[var(--leaf)]" role="status">{saved}</p>}<button className="mt-5 h-12 w-full rounded-xl bg-[var(--leaf)] font-semibold text-white disabled:opacity-50" disabled={!foodName || effectiveRate.caloriesPerG <= 0} type="submit">Log food</button></form>
  </div>;
}
