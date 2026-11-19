"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconHistory, IconLog } from "@/components/icons";
import FoodLogRow from "@/components/food-log-row";

type Log = { id: number; log_date: string; food_name: string; meal_type: string; weight_g: number; calories: number; is_recipe?: boolean };

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatPrettyDate(dateStr: string) {
  const today = dateOffset(0);
  const yesterday = dateOffset(-1);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
}

export default function HistoryContent() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch(`/api/food/log?from=${dateOffset(-29)}&to=${dateOffset(0)}`)
      .then(async (response) => {
        const payload = await response.json();
        setIsLoading(false);
        if (!response.ok) throw new Error(payload.error?.message ?? "Unable to load history.");
        setLogs(payload.logs);
      })
      .catch((reason: unknown) => {
        setIsLoading(false);
        setError(reason instanceof Error ? reason.message : "Unable to load history.");
      });
  }, [refreshKey]);

  if (error)
    return (
      <div className="rounded-2xl border border-[var(--coral)]/30 bg-[var(--coral)]/10 p-5 text-sm font-semibold text-[var(--coral)]" role="alert">
        {error}
      </div>
    );

  if (isLoading)
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-16 rounded-2xl bg-[var(--surface-muted)]" />
        <div className="h-36 rounded-2xl bg-[var(--surface-muted)]" />
        <div className="h-36 rounded-2xl bg-[var(--surface-muted)]" />
      </div>
    );

  const grouped = logs.reduce<Record<string, Log[]>>((days, log) => {
    (days[log.log_date] ??= []).push(log);
    return days;
  }, {});

  return (
    <div className="space-y-6">
      {/* Retention Callout Notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs leading-relaxed text-[var(--ink-muted)]">
        <IconHistory className="size-5 shrink-0 text-[var(--leaf)] mt-0.5" />
        <div>
          <strong className="block text-xs font-bold text-[var(--foreground)]">30-Day Detail Retention</strong>
          Detailed itemized logs and food photos are kept for 30 days. Your streak counts and progress trends are stored permanently in daily summaries.
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-xs">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--surface-muted)] text-[var(--ink-muted)]">
            <IconHistory className="size-6" />
          </div>
          <h2 className="mt-4 text-base font-bold text-[var(--foreground)]">No Meal History Yet</h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Your logged meals from the past 30 days will show up here grouped by day.
          </p>
          <Link
            href="/log"
            className="active-press mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--leaf)] px-4 py-2.5 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)]"
          >
            <IconLog className="size-4" />
            <span>Log a Meal Now</span>
          </Link>
        </div>
      ) : (
        Object.entries(grouped).map(([date, dayLogs]) => {
          const dayTotal = dayLogs.reduce((sum, log) => sum + Number(log.calories), 0);
          return (
            <section
              className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs transition-shadow hover:shadow-sm"
              key={date}
            >
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[var(--foreground)]">{formatPrettyDate(date)}</h2>
                  <span className="text-xs text-[var(--ink-muted)]">({date})</span>
                </div>
                <span className="tabular-nums rounded-full bg-[var(--leaf-light)] px-3 py-1 text-xs font-extrabold text-[var(--leaf)]">
                  {Math.round(dayTotal)} kcal
                </span>
              </div>

              <div className="mt-4 divide-y divide-[var(--line)]/50">
                {dayLogs.map((log) => (
                  <FoodLogRow key={log.id} log={log} onChanged={() => setRefreshKey((key) => key + 1)} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
