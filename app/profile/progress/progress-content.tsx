"use client";

import { useEffect, useState, type ReactNode } from "react";

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

type Summary = { summary_date: string; total_calories: number; calories_burned: number };
type Weight = { log_date: string; weight_kg: number };

export default function ProgressContent() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [targetCalories, setTargetCalories] = useState<number | null>(null);
  const [selectedCalories, setSelectedCalories] = useState(0);
  const [selectedWeight, setSelectedWeight] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const from = dateOffset(-29);
    const to = dateOffset(0);
    Promise.all([
      fetch(`/api/summaries?from=${from}&to=${to}`).then((response) => response.json()),
      fetch(`/api/weight?from=${from}&to=${to}`).then((response) => response.json()),
      fetch("/api/profile").then((response) => response.json()),
    ]).then(([summaryPayload, weightPayload, profilePayload]) => {
      if (summaryPayload.error || weightPayload.error || profilePayload.error) {
        throw new Error(summaryPayload.error?.message ?? weightPayload.error?.message ?? profilePayload.error?.message);
      }
      setSummaries(summaryPayload.summaries ?? []);
      setWeights(weightPayload.logs ?? []);
      const target = Number(profilePayload.profile?.target_calories);
      setTargetCalories(Number.isFinite(target) && target > 0 ? target : null);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load progress."));
  }, []);

  if (error) return <p className="rounded-2xl bg-[var(--coral-soft)] p-5 text-sm text-[var(--coral)]" role="alert">{error}</p>;

  const maxCalories = Math.max(...summaries.map((item) => Number(item.total_calories)), targetCalories ?? 1, 1);
  const latestWeight = weights.at(-1)?.weight_kg;
  const firstWeight = weights[0]?.weight_kg;
  const selectedSummary = summaries[selectedCalories] ?? summaries[0];
  const selectedWeightLog = weights[selectedWeight] ?? weights[0];
  const maxWeight = Math.max(...weights.map((item) => Number(item.weight_kg)), 1);

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><p className="text-sm text-[var(--ink-muted)]">Latest weight</p><p className="mt-2 text-3xl font-semibold">{latestWeight ? `${Number(latestWeight).toFixed(1)} kg` : "Not logged"}</p>{latestWeight && firstWeight && <p className="mt-1 text-xs text-[var(--ink-muted)]">{(Number(latestWeight) - Number(firstWeight)).toFixed(1)} kg since first check-in</p>}</div>
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><p className="text-sm text-[var(--ink-muted)]">Logged days</p><p className="mt-2 text-3xl font-semibold">{summaries.filter((item) => Number(item.total_calories) > 0).length}<span className="text-base font-normal text-[var(--ink-muted)]"> / 30</span></p><p className="mt-1 text-xs text-[var(--ink-muted)]">permanent daily summaries</p></div>
    </div>

    <ChartSection title="Daily calories" subtitle="last 30 days" readout={selectedSummary ? `${selectedSummary.summary_date}: ${Math.round(Number(selectedSummary.total_calories))} kcal${targetCalories ? `; target ${Math.round(targetCalories)} kcal` : ""}` : "No calorie data yet."}>
      {summaries.length === 0 ? <p className="mt-4 text-sm text-[var(--ink-muted)]">Not enough summary data yet. Keep logging to build your trend.</p> : <div className="mt-5">
        <div className="overflow-x-auto"><div className="relative flex h-40 min-w-[1320px] items-end gap-1 border-b border-l border-[var(--line)] px-1" aria-label="Daily calories bar chart">
          {targetCalories && <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--coral)]" style={{ bottom: `${(targetCalories / maxCalories) * 100}%` }}><span className="absolute -top-5 right-0 text-[10px] font-semibold text-[var(--coral)]">Target {Math.round(targetCalories)}</span></div>}
          {summaries.map((item, index) => <button type="button" className={`group flex h-full min-w-11 flex-1 items-end rounded-t-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--leaf)] ${selectedCalories === index ? "bg-[var(--leaf-light)]" : ""}`} key={item.summary_date} onFocus={() => setSelectedCalories(index)} onClick={() => setSelectedCalories(index)} aria-label={`${item.summary_date}: ${Math.round(Number(item.total_calories))} kcal`}><span className="w-full rounded-t-md bg-[var(--leaf)] transition-opacity group-hover:opacity-70" style={{ height: `${Math.max(4, Number(item.total_calories) / maxCalories * 100)}%` }} /></button>)}
        </div></div>
        <div className="mt-2 flex justify-between text-[10px] text-[var(--ink-muted)]"><span>{summaries[0]?.summary_date}</span><span>Days ago</span><span>{summaries.at(-1)?.summary_date}</span></div>
        <table className="sr-only"><caption>Daily calories for the last 30 days</caption><thead><tr><th scope="col">Date</th><th scope="col">Calories</th></tr></thead><tbody>{summaries.map((item) => <tr key={item.summary_date}><th scope="row">{item.summary_date}</th><td>{Math.round(Number(item.total_calories))} kcal</td></tr>)}</tbody></table>
      </div>}
    </ChartSection>

    <ChartSection title="Weight trend" subtitle="last 30 days" readout={selectedWeightLog ? `${selectedWeightLog.log_date}: ${Number(selectedWeightLog.weight_kg).toFixed(1)} kg` : "No weight data yet."}>
      {weights.length < 2 ? <p className="mt-4 text-sm text-[var(--ink-muted)]">Add at least two check-ins to see a weight trend.</p> : <div className="mt-5">
        <div className="overflow-x-auto"><div className="flex h-40 min-w-[1320px] items-end gap-1 border-b border-l border-[var(--line)] px-1" aria-label="Weight trend bar chart">{weights.map((item, index) => <button type="button" className={`group flex h-full min-w-11 flex-1 items-end rounded-t-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--leaf)] ${selectedWeight === index ? "bg-[var(--leaf-light)]" : ""}`} key={`${item.log_date}-${item.weight_kg}`} onFocus={() => setSelectedWeight(index)} onClick={() => setSelectedWeight(index)} aria-label={`${item.log_date}: ${Number(item.weight_kg).toFixed(1)} kilograms`}><span className="w-full rounded-t-md bg-[var(--sun)]" style={{ height: `${Math.max(12, Number(item.weight_kg) / maxWeight * 100)}%` }} /></button>)}</div></div>
        <div className="mt-2 flex justify-between text-[10px] text-[var(--ink-muted)]"><span>{weights[0]?.log_date}</span><span>kg</span><span>{weights.at(-1)?.log_date}</span></div>
        <table className="sr-only"><caption>Weight check-ins for the last 30 days</caption><thead><tr><th scope="col">Date</th><th scope="col">Weight</th></tr></thead><tbody>{weights.map((item) => <tr key={`${item.log_date}-${item.weight_kg}`}><th scope="row">{item.log_date}</th><td>{Number(item.weight_kg).toFixed(1)} kg</td></tr>)}</tbody></table>
      </div>}
    </ChartSection>
  </div>;
}

function ChartSection({ title, subtitle, readout, children }: { title: string; subtitle: string; readout: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">{title}</h2><span className="text-xs text-[var(--ink-muted)]">{subtitle}</span></div><p className="mt-3 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--foreground)]" aria-live="polite">Selected: {readout}</p>{children}</section>;
}
