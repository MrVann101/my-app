"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconHistory, IconLog } from "@/components/icons";
import FoodLogRow from "@/components/food-log-row";

type Log = {
  id: number;
  log_date: string;
  food_name: string;
  meal_type: string;
  weight_g: number;
  calories: number;
  is_recipe?: boolean;
};

const SLOT_FILTERS = ["all", "breakfast", "lunch", "dinner", "snack"] as const;
type SlotFilter = (typeof SLOT_FILTERS)[number];

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
  const [searchQuery, setSearchQuery] = useState("");
  const [slotFilter, setSlotFilter] = useState<SlotFilter>("all");

  useEffect(() => {
    let active = true;
    fetch(`/api/food/log?from=${dateOffset(-29)}&to=${dateOffset(0)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Unable to load history.");
        if (active) {
          setError(null);
          setLogs(payload.logs ?? []);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load history.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      const normalizedSlot = (log.meal_type ?? "").toLowerCase() === "snacks" ? "snack" : (log.meal_type ?? "").toLowerCase();
      if (slotFilter !== "all" && normalizedSlot !== slotFilter) return false;
      if (q && !log.food_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, searchQuery, slotFilter]);

  const grouped = useMemo(
    () =>
      filteredLogs.reduce<Record<string, Log[]>>((days, log) => {
        (days[log.log_date] ??= []).push(log);
        return days;
      }, {}),
    [filteredLogs],
  );

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] p-5 text-sm font-semibold text-[var(--coral)]" role="alert">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsLoading(true);
            setRefreshKey((key) => key + 1);
          }}
          className="active-press mt-3 inline-flex min-h-11 items-center rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
        >
          Try again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-16 rounded-2xl bg-[var(--surface-muted)]" />
        <div className="h-36 rounded-2xl bg-[var(--surface-muted)]" />
        <div className="h-36 rounded-2xl bg-[var(--surface-muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5 text-xs text-[var(--ink-muted)]">
        <IconHistory className="size-4 shrink-0 text-[var(--leaf)]" />
        <span>30-day detailed food log archive. Streaks and daily totals are saved permanently.</span>
      </div>

      {logs.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <label htmlFor="history-search" className="sr-only">Filter logged foods</label>
            <input
              id="history-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Filter past meals by food name..."
              className="h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3.5 text-sm font-medium outline-none focus:border-[var(--leaf)]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by meal slot">
            {SLOT_FILTERS.map((slot) => (
              <button
                key={slot}
                type="button"
                aria-pressed={slotFilter === slot}
                onClick={() => setSlotFilter(slot)}
                className={`active-press min-h-11 rounded-xl px-3.5 text-xs font-semibold capitalize transition-colors ${
                  slotFilter === slot
                    ? "bg-[var(--leaf)] text-[var(--on-leaf)]"
                    : "border border-[var(--border-control)] bg-[var(--surface-muted)] text-[var(--ink-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      )}

      {logs.length === 0 ? (
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
            className="active-press mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--leaf)] px-4 py-2.5 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)]"
          >
            <IconLog className="size-4" />
            <span>Log a Meal Now</span>
          </Link>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-center text-xs text-[var(--ink-muted)]">
          No logged meals match your current search or meal filter.
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
                <span className="tabular-nums rounded-full bg-[var(--leaf-light)] px-3 py-1 text-xs font-extrabold text-[var(--leaf-ink)]">
                  {Math.round(dayTotal)} kcal
                </span>
              </div>

              <div className="mt-3 divide-y divide-[var(--line)]/50">
                {dayLogs.map((log) => (
                  <FoodLogRow
                    key={log.id}
                    log={log}
                    dateLabel="this day's"
                    onChanged={() => setRefreshKey((key) => key + 1)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
