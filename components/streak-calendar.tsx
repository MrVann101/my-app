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

function formatDateStr(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export default function StreakCalendar({ currentStreak = 0 }: { currentStreak?: number }) {
  const [cursor, setCursor] = useState<MonthCursor | null>(null);
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const [expandedMobile, setExpandedMobile] = useState(false);

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

  return (
    <section className="space-y-4 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs sm:p-6">
      <div className="space-y-3 border-b border-[var(--line)] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">Log Consistency</h2>
            <p className="text-xs text-[var(--ink-muted)]">Track your streak and calorie-target days</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[var(--leaf-light)] px-3 py-1.5 text-xs font-extrabold text-[var(--leaf-ink)] shadow-2xs">
            <IconFlame className="size-4 text-[var(--leaf)]" />
            <span className="tabular-nums">{currentStreak} Day Streak</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="active-press grid size-11 place-items-center rounded-lg text-xs font-bold text-[var(--foreground)] hover:bg-[var(--line)]"
              aria-label="Previous month"
            >
              <IconChevronLeft className="size-4" />
            </button>
            <span className="min-w-[110px] px-2 text-center text-xs font-bold text-[var(--foreground)]">
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

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--ink-muted)]" aria-label="Calendar legend">
            <span className="inline-flex items-center gap-1.5">
              <span className="grid size-5 place-items-center rounded-md bg-[var(--leaf)] text-[var(--on-leaf)]" aria-hidden="true">
                <IconFlame className="size-3" />
              </span>
              Logged
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="grid size-5 place-items-center rounded-md bg-[var(--leaf)] text-[var(--on-leaf)]" aria-hidden="true">
                <IconCheck className="size-3 stroke-[3]" />
              </span>
              Target hit
            </span>
          </div>
        </div>
      </div>

      {/* Weekday Column Labels */}
      <div className="grid grid-cols-7 gap-1 border-b border-[var(--line)]/40 pb-2 text-center">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day} className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            {day}
          </span>
        ))}
      </div>

      {/* Mobile Compact 7-day strip (when collapsed) */}
      {!expandedMobile && (
        <div className="grid grid-cols-7 gap-1.5 text-center sm:hidden">
          {currentWeekDays.map((day, idx) => (
            <CalendarCell key={day.dateStr || `week-${idx}`} day={day} summary={day.dateStr ? summaries[day.dateStr] : undefined} />
          ))}
        </div>
      )}

      {/* Full Month Grid (always visible >= sm, or when expanded on mobile) */}
      <div className={`${expandedMobile ? "grid" : "hidden sm:grid"} grid-cols-7 gap-1.5 text-center`}>
        {monthDays.map((day, idx) => (
          <CalendarCell key={day.dateStr || `blank-${idx}`} day={day} summary={day.dateStr ? summaries[day.dateStr] : undefined} />
        ))}
      </div>

      <div className="flex justify-center sm:hidden">
        <button
          type="button"
          onClick={() => setExpandedMobile((open) => !open)}
          aria-expanded={expandedMobile}
          className="active-press inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] px-4 text-xs font-bold text-[var(--foreground)] hover:border-[var(--leaf)]"
        >
          {expandedMobile ? "Show current week" : "Show full month"}
        </button>
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
      <div className="flex h-10 items-center justify-center opacity-30">
        <span className="tabular-nums text-xs text-[var(--ink-muted)]">{day.dayNumber}</span>
      </div>
    );
  }

  const hasLogged = Boolean(summary?.logged_at_least_once);
  const hitTarget = Boolean(summary?.hit_target);

  return (
    <div
      className={`flex h-10 flex-col items-center justify-center rounded-xl transition-colors ${
        day.isToday
          ? "ring-2 ring-[var(--leaf)] ring-offset-2 ring-offset-[var(--surface)] font-black"
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
      <span className="tabular-nums text-xs font-bold leading-none">{day.dayNumber}</span>
      {hasLogged && (
        <span className="mt-0.5">
          {hitTarget ? <IconCheck className="size-3 stroke-[3]" /> : <IconFlame className="size-3" />}
        </span>
      )}
    </div>
  );
}
