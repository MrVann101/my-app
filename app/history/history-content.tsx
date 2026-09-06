"use client";

import { useEffect, useState } from "react";

type Log = { id: number; log_date: string; food_name: string; meal_type: string; weight_g: number; calories: number };

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export default function HistoryContent() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/food/log?from=${dateOffset(-29)}&to=${dateOffset(0)}`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to load history.");
      setLogs(payload.logs);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load history."));
  }, []);

  if (error) return <p className="rounded-2xl bg-[#fff0eb] p-5 text-sm text-[var(--coral)]" role="alert">{error}</p>;
  const grouped = logs.reduce<Record<string, Log[]>>((days, log) => { (days[log.log_date] ??= []).push(log); return days; }, {});
  return <div className="space-y-5"><div className="rounded-2xl bg-[var(--surface-muted)] p-5 text-sm leading-6 text-[var(--ink-muted)]">Detailed meal history is kept for 30 days. Your streaks and progress stats are kept permanently.</div>{Object.keys(grouped).length === 0 ? <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--ink-muted)]">No meals logged in the last 30 days.</div> : Object.entries(grouped).map(([date, dayLogs]) => <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5" key={date}><div className="flex items-center justify-between"><h2 className="font-semibold">{date}</h2><span className="text-sm text-[var(--ink-muted)]">{Math.round(dayLogs.reduce((sum, log) => sum + Number(log.calories), 0))} kcal</span></div><div className="mt-4 space-y-3">{dayLogs.map((log) => <div className="flex items-center justify-between text-sm" key={log.id}><span>{log.food_name} <span className="text-[var(--ink-muted)]">· {log.meal_type} · {log.weight_g}g</span></span><span>{Math.round(Number(log.calories))} kcal</span></div>)}</div></section>)}</div>;
}
