"use client";

import { useEffect, useState } from "react";

type Weekly = { summary: { summary: string; daysTracked: number; averageCalories: number; averageNetCalories: number; averageProteinG: number; totalExerciseCalories: number; targetHitDays: number }; from: string; to: string };

export default function WeeklySummary() {
  const [data, setData] = useState<Weekly | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => { fetch("/api/summary/weekly").then((response) => response.json()).then(setData).catch(() => setData(null)); }, 0); return () => window.clearTimeout(timer); }, []);
  if (!data) return null;
  return <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Weekly summary</h2><span className="text-xs text-[var(--ink-muted)]">{data.from} to {data.to}</span></div><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{data.summary.summary}</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5"><div><p className="text-xs text-[var(--ink-muted)]">Logged days</p><p className="mt-1 font-semibold">{data.summary.daysTracked}</p></div><div><p className="text-xs text-[var(--ink-muted)]">Avg calories</p><p className="mt-1 font-semibold">{Math.round(data.summary.averageCalories)}</p></div><div><p className="text-xs text-[var(--ink-muted)]">Avg net</p><p className="mt-1 font-semibold">{Math.round(data.summary.averageNetCalories)}</p></div><div><p className="text-xs text-[var(--ink-muted)]">Avg protein</p><p className="mt-1 font-semibold">{Math.round(data.summary.averageProteinG)}g</p></div><div><p className="text-xs text-[var(--ink-muted)]">Target days</p><p className="mt-1 font-semibold">{data.summary.targetHitDays}</p></div></div></section>;
}
