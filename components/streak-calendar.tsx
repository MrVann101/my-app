"use client";

import { useEffect, useMemo, useState } from "react";
import { IconFlame, IconCheck, IconChevronLeft, IconChevronRight } from "./icons";

type Summary = { summary_date: string; logged_at_least_once: boolean; hit_target: boolean; total_calories: number };

type MonthCursor = {
  year: number;
  month: number;
  todayStr: string;
  nowYear: number;
  nowMonth: number;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function formatDateStr(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export default function StreakCalendar({ currentStreak = 0 }: { currentStreak?: number }) {
  const [cursor, setCursor] = useState<MonthCursor | null>(null);
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const now = new Date();
      setCursor({
        year: now.getFullYear(),
        month: now.getMonth(),
        todayStr: formatDateStr(now),
        nowYear: now.getFullYear(),
        nowMonth: now.getMonth(),
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const year = cursor?.year ?? 2026;
  const month = cursor?.month ?? 0;
  const todayStr = cursor?.todayStr ?? "";
  const isCurrentOrFutureMonth = cursor ? year > cursor.nowYear || (year === cursor.nowYear && month >= cursor.nowMonth) : true;

  const monthName = useMemo(() => {
    if (!cursor) return "Loading...";
    return new Date(year, month, 1).toLocaleString("default", { month: "long", year: "numeric" });
  }, [cursor, year, month]);

  const monthDays = useMemo(() => {
    if (!cursor) return [];
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({ dateStr: "", dayNumber: prevMonthLastDay - i, isCurrentMonth: false, isToday: false });
    }

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, "0");
      const dayStr = String(d).padStart(2, "0");
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [cursor, year, month, todayStr]);

  const currentWeekDays = useMemo(() => {
    if (!monthDays.length) return [];
    const todayIndex = monthDays.findIndex((day) => day.isToday);
    if (todayIndex >= 0) {
      const weekStart = Math.floor(todayIndex / 7) * 7;
      return monthDays.slice(weekStart, weekStart + 7);
    }
    return monthDays.slice(-7);
  }, [monthDays]);

  useEffect(() => {
    if (!cursor) return;
    const fromStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const toStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    let active = true;
    fetch(`/api/summaries?from=${fromStr}&to=${toStr}`)
      .then((res) => res.json())
      .then((payload) => {
        if (!active || !payload.summaries) return;
        const map: Record<string, Summary> = {};
        for (const s of payload.summaries as Summary[]) {
          map[s.summary_date] = s;
        }
        setSummaries(map);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [cursor, year, month]);

  function changeMonth(delta: number) {
    setCursor((prev) => {
      if (!prev) return prev;
      const next = new Date(prev.year, prev.month + delta, 1);
      return { ...prev, year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function toggleExpanded() {
    setExpanded((wasOpen) => {
      const nextOpen = !wasOpen;
      if (!nextOpen) {
        setCursor((prev) => (prev ? { ...prev, year: prev.nowYear, month: prev.nowMonth } : prev));
      }
      return nextOpen;
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--leaf-light)] text-[var(--leaf-ink)]">
            <IconFlame className="size-4 text-[var(--leaf)]" />
          </div>
          <div className="min-w-0">
            <h2 className="tabular-nums truncate text-sm font-bold text-[var(--foreground)]">
              {currentStreak} Day Streak
            </h2>
            <p className="text-[11px] text-[var(--ink-muted)]">
              {expanded ? monthName : "This week"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          className="active-press inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] px-3 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--leaf)]"
        >
          <span>{expanded ? "This week" : "Full month"}</span>
        </button>
      </div>

      {expanded && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
          <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-0.5">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="active-press grid size-11 place-items-center rounded-lg text-xs font-bold text-[var(--foreground)] hover:bg-[var(--line)]"
              aria-label="Previous month"
            >
              <IconChevronLeft className="size-4" />
            </button>
            <span className="min-w-[104px] px-1.5 text-center text-xs font-bold text-[var(--foreground)]">
              {monthName}
            </span>
            <button
              type="button"
              disabled={isCurrentOrFutureMonth}
              onClick={() => changeMonth(1)}
              className="active-press grid size-11 place-items-center rounded-lg text-xs font-bold text-[var(--foreground)] hover:bg-[var(--line)] disabled:opacity-35"
              aria-label="Next month"
            >
              <IconChevronRight className="size-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[var(--ink-muted)]" aria-label="Calendar legend">
            <span className="inline-flex items-center gap-1">
              <span className="grid size-4 place-items-center rounded bg-[var(--leaf)] text-[var(--on-leaf)]" aria-hidden="true">
                <IconFlame className="size-2.5" />
              </span>
              Logged
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="grid size-4 place-items-center rounded bg-[var(--leaf)] text-[var(--on-leaf)]" aria-hidden="true">
                <IconCheck className="size-2.5 stroke-[3]" />
              </span>
              Target hit
            </span>
          </div>
        </div>
      )}

      {/* Weekday Column Labels */}
      <div className="grid grid-cols-7 gap-1 border-b border-[var(--line)]/50 pb-1.5 text-center">
        {WEEKDAY_LABELS.map((day) => (
          <span key={day} className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            {day}
          </span>
        ))}
      </div>

      {/* Compact 7-day strip (default on both mobile & desktop) vs expanded full month */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {(expanded ? monthDays : currentWeekDays).map((day, idx) => (
          <CalendarCell
            key={day.dateStr || `${expanded ? "blank" : "week"}-${idx}`}
            day={day}
            summary={day.dateStr ? summaries[day.dateStr] : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function CalendarCell({
  day,
  summary,
}: {
  day: { dateStr: string; dayNumber: number; isCurrentMonth: boolean; isToday: boolean };
  summary?: Summary;
}) {
  if (!day.isCurrentMonth) {
    return (
      <div className="flex h-9 items-center justify-center opacity-30">
        <span className="tabular-nums text-[11px] text-[var(--ink-muted)]">{day.dayNumber}</span>
      </div>
    );
  }

  const hasLogged = Boolean(summary?.logged_at_least_once);
  const hitTarget = Boolean(summary?.hit_target);

  return (
    <div
      className={`flex h-9 flex-col items-center justify-center rounded-lg transition-colors ${
        day.isToday
          ? "ring-2 ring-[var(--leaf)] ring-offset-1 ring-offset-[var(--surface)] font-black"
          : ""
      } ${
        hasLogged
          ? "bg-[var(--leaf)] text-[var(--on-leaf)] shadow-2xs"
          : "bg-[var(--surface-muted)] text-[var(--foreground)]"
      }`}
      title={
        summary
          ? `${day.dateStr}: ${Math.round(summary.total_calories)} kcal${hitTarget ? " (Target hit)" : ""}`
          : day.dateStr
      }
    >
      <span className="tabular-nums text-[11px] font-bold leading-none">{day.dayNumber}</span>
      {hasLogged && (
        <span className="mt-0.5">
          {hitTarget ? <IconCheck className="size-2.5 stroke-[3]" /> : <IconFlame className="size-2.5" />}
        </span>
      )}
    </div>
  );
}
