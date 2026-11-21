"use client";

import { useEffect, useState } from "react";

type Weekly = {
  summary: {
    summary: string;
    daysTracked: number;
    averageCalories: number;
    averageNetCalories: number;
    averageProteinG: number;
    totalExerciseCalories: number;
    targetHitDays: number;
  };
  from: string;
  to: string;
};

export default function WeeklySummary() {
  const [data, setData] = useState<Weekly | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/summary/weekly", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <section className="animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="h-5 w-40 rounded bg-[var(--surface-muted)]" />
        <div className="mt-4 h-4 w-full rounded bg-[var(--surface-muted)]" />
        <div className="mt-2 h-4 w-3/4 rounded bg-[var(--surface-muted)]" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-[var(--coral)]/30 bg-[var(--surface)] p-5" role="alert">
        <p className="font-semibold text-[var(--coral)]">Unable to load your weekly summary.</p>
        <button
          className="active-press mt-3 min-h-11 rounded-xl border border-[var(--border-control)] px-4 py-2 text-sm font-semibold hover:bg-[var(--surface-muted)]"
          onClick={() => void load()}
          type="button"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!data || data.summary.daysTracked === 0) {
    return (
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="font-semibold">Weekly summary</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
          No meals logged this week yet. Log a meal to start building your summary.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Weekly summary</h2>
        <span className="text-xs text-[var(--ink-muted)]">{data.from} to {data.to}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{data.summary.summary}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <p className="text-xs text-[var(--ink-muted)]">Logged days</p>
          <p className="tabular-nums mt-1 font-semibold">{data.summary.daysTracked}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--ink-muted)]">Avg calories</p>
          <p className="tabular-nums mt-1 font-semibold">{Math.round(data.summary.averageCalories)} kcal</p>
        </div>
        <div>
          <p className="text-xs text-[var(--ink-muted)]">Avg net</p>
          <p className="tabular-nums mt-1 font-semibold">{Math.round(data.summary.averageNetCalories)} kcal</p>
        </div>
        <div>
          <p className="text-xs text-[var(--ink-muted)]">Avg protein</p>
          <p className="tabular-nums mt-1 font-semibold">{Math.round(data.summary.averageProteinG)}g</p>
        </div>
        <div>
          <p className="text-xs text-[var(--ink-muted)]">Target days</p>
          <p className="tabular-nums mt-1 font-semibold">{data.summary.targetHitDays}</p>
        </div>
      </div>
    </section>
  );
}
