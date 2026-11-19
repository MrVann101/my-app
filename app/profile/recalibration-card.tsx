"use client";

import { useEffect, useState } from "react";

type Recommendation = { recommendedCalories: number; actualWeeklyChangeKg: number; expectedWeeklyChangeKg: number; direction: "increase" | "decrease" | "none" };
type Payload = { eligible: boolean; checkins: number; requiredCheckins: number; recommendation?: Recommendation };

export default function RecalibrationCard() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function load() { setLoading(true); setError(false); try { const response = await fetch("/api/recalibration"); if (!response.ok) throw new Error(); setData(await response.json()); } catch { setError(true); } finally { setLoading(false); } }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);
  if (loading) return <section className="mt-6 animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"><div className="h-4 w-32 rounded bg-[var(--surface-muted)]" /><div className="mt-3 h-4 w-full rounded bg-[var(--surface-muted)]" /><div className="mt-2 h-4 w-2/3 rounded bg-[var(--surface-muted)]" /></section>;
  if (error) return <section className="mt-6 rounded-2xl border border-[var(--coral)]/30 bg-[var(--surface)] p-4" role="alert"><p className="font-semibold">Unable to load recalibration</p><button className="mt-3 min-h-11 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold" onClick={() => void load()} type="button">Try again</button></section>;
  if (!data?.eligible || !data.recommendation) return <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"><p className="font-semibold">Adaptive recalibration</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{data?.checkins ?? 0} of {data?.requiredCheckins ?? 3} weigh-ins recorded — log weight check-ins to unlock adaptive calorie recalibration.</p><a className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--leaf)]" href="/profile/body-stats">Log a weigh-in</a></section>;
  const { recommendation } = data;
  async function respond(action: "accepted" | "dismissed") { const response = await fetch("/api/recalibration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, recommendedCalories: recommendation.recommendedCalories }) }); if (response.ok) setMessage(action === "accepted" ? "Recommendation saved." : "Recommendation dismissed."); }
  return <section className="mt-6 rounded-2xl border border-[var(--leaf)]/30 bg-[var(--surface)] p-4"><p className="font-semibold">Target check-in</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Your recent weight trend differs from the expected pace. Consider a target of <strong>{Math.round(recommendation.recommendedCalories).toLocaleString()} kcal/day</strong>.</p><p className="mt-2 text-xs text-[var(--ink-muted)]">Actual trend: {recommendation.actualWeeklyChangeKg.toFixed(2)} kg/week · expected: {recommendation.expectedWeeklyChangeKg.toFixed(2)} kg/week</p><div className="mt-4 flex gap-2"><button className="rounded-xl bg-[var(--leaf)] px-3 py-2 text-sm font-semibold text-[var(--on-leaf)]" onClick={() => void respond("accepted")} type="button">Use suggestion</button><button className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--leaf)]" onClick={() => void respond("dismissed")} type="button">Dismiss</button></div>{message && <p className="mt-3 text-sm text-[var(--leaf)]" role="status">{message}</p>}</section>;
}
