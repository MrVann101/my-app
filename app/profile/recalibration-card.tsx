"use client";

import { useEffect, useState } from "react";

type Recommendation = { recommendedCalories: number; actualWeeklyChangeKg: number; expectedWeeklyChangeKg: number; direction: "increase" | "decrease" | "none" };
type Payload = { eligible: boolean; checkins: number; requiredCheckins: number; recommendation?: Recommendation };

export default function RecalibrationCard() {
  const [data, setData] = useState<Payload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => { fetch("/api/recalibration").then((response) => response.json()).then(setData).catch(() => setData(null)); }, 0); return () => window.clearTimeout(timer); }, []);
  if (!data || !data.eligible || !data.recommendation) return null;
  const { recommendation } = data;
  async function respond(action: "accepted" | "dismissed") { const response = await fetch("/api/recalibration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, recommendedCalories: recommendation.recommendedCalories }) }); if (response.ok) setMessage(action === "accepted" ? "Recommendation saved." : "Recommendation dismissed."); }
  return <section className="mt-6 rounded-2xl border border-[#d9e6cf] bg-[#f4f8ef] p-4"><p className="font-semibold">Target check-in</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Your recent weight trend differs from the expected pace. Consider a target of <strong>{Math.round(recommendation.recommendedCalories).toLocaleString()} kcal/day</strong>.</p><p className="mt-2 text-xs text-[var(--ink-muted)]">Actual trend: {recommendation.actualWeeklyChangeKg.toFixed(2)} kg/week · expected: {recommendation.expectedWeeklyChangeKg.toFixed(2)} kg/week</p><div className="mt-4 flex gap-2"><button className="rounded-xl bg-[var(--leaf)] px-3 py-2 text-sm font-semibold text-white" onClick={() => void respond("accepted")} type="button">Use suggestion</button><button className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--leaf)]" onClick={() => void respond("dismissed")} type="button">Dismiss</button></div>{message && <p className="mt-3 text-sm text-[var(--leaf)]" role="status">{message}</p>}</section>;
}
