"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { displayNutrient } from "@/lib/food";
import SuggestionsCard from "./suggestions-card";

type Dashboard = { needsOnboarding?: boolean; targetCalories?: number; caloriesConsumed?: number; caloriesBurned?: number; caloriesRemaining?: number; macros?: { proteinG: number; carbsG: number; fatG: number; fiberG: number; sodiumMg: number; sugarG: number; targetProteinG: number; targetCarbsG: number; targetFatG: number }; streak?: { current_streak: number }; logs?: { id: number; food_name: string; calories: number; meal_type: string; source: string }[] };

export default function DashboardContent() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard").then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to load dashboard.");
      setData(payload);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load dashboard."));
  }, []);

  if (error) return <p className="rounded-2xl bg-[#fff0eb] p-5 text-sm text-[var(--coral)]" role="alert">{error}</p>;
  if (!data) return <div className="h-40 animate-pulse rounded-[2rem] bg-[var(--surface-muted)]" aria-label="Loading dashboard" />;
  if (data.needsOnboarding) return <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6"><p className="font-semibold">Finish your starting point first.</p><Link className="mt-4 inline-block rounded-xl bg-[var(--leaf)] px-4 py-3 text-sm font-semibold text-white" href="/onboarding">Open onboarding</Link></div>;

  const progress = data.targetCalories ? Math.min(100, (data.caloriesConsumed! / data.targetCalories) * 100) : 0;
  const macros = data.macros!;
  return <div className="space-y-5"><div className="rounded-[2rem] bg-[var(--leaf-deep)] p-6 text-white"><p className="text-sm text-[#bdd6bd]">Calories remaining</p><p className="mt-2 text-6xl font-semibold tracking-[-0.06em]">{Math.round(data.caloriesRemaining!).toLocaleString()}</p><p className="mt-2 text-sm text-[#bdd6bd]">{Math.round(data.caloriesConsumed!).toLocaleString()} consumed · {Math.round(data.caloriesBurned!).toLocaleString()} exercise credit</p><div className="mt-6 h-2 rounded-full bg-white/15"><div className="h-full rounded-full bg-[var(--sun)]" style={{ width: `${progress}%` }} /></div></div><div className="grid gap-4 sm:grid-cols-3">{[["Protein", macros.proteinG, macros.targetProteinG, "g"], ["Carbs", macros.carbsG, macros.targetCarbsG, "g"], ["Fat", macros.fatG, macros.targetFatG, "g"], ["Fiber", macros.fiberG, null, "g"], ["Sodium", macros.sodiumMg, null, "mg"], ["Sugar", macros.sugarG, null, "g"]].map(([label, value, target, unit]) => <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5" key={label as string}><p className="text-sm text-[var(--ink-muted)]">{label}</p><p className="mt-2 text-2xl font-semibold">{displayNutrient(value as number, value as number > 0 ? "usda" : "manual", unit as string)}</p>{target ? <p className="mt-1 text-xs text-[var(--ink-muted)]">of {Math.round(target as number)}{unit} target</p> : <p className="mt-1 text-xs text-[var(--ink-muted)]">tracked today</p>}</div>)}</div><div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex justify-between"><p className="font-semibold">Today&apos;s meals</p><span className="text-sm text-[var(--leaf)]">{data.streak!.current_streak} day streak</span></div>{data.logs?.length ? <div className="mt-4 space-y-3">{data.logs.map((log) => <div className="flex justify-between text-sm" key={log.id}><span>{log.food_name} <span className="text-[var(--ink-muted)]">· {log.meal_type} · {log.source}</span></span><span>{Math.round(Number(log.calories))} kcal</span></div>)}</div> : <p className="mt-3 text-sm text-[var(--ink-muted)]">No meals logged today.</p>}</div><SuggestionsCard /></div>;
}
