"use client";

import { useEffect, useState, useMemo } from "react";
import { IconFlame, IconCheck } from "./icons";

type Summary = { summary_date: string; logged_at_least_once: boolean; hit_target: boolean; total_calories: number };

export default function StreakCalendar({ currentStreak = 0 }: { currentStreak?: number }) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = useMemo(() => {
    return currentDate.toLocaleString("default", { month: "long", year: "numeric" });
  }, [currentDate]);

  const monthDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Get starting day of week: 0 = Mon, 6 = Sun
    const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const todayStr = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

    const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Leading previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({ dateStr: "", dayNumber: prevMonthLastDay - i, isCurrentMonth: false, isToday: false });
    }

    // Current month days
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
  }, [year, month]);

  useEffect(() => {
    const fromStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const toStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    fetch(`/api/summaries?from=${fromStr}&to=${toStr}`)
      .then((res) => res.json())
      .then((payload) => {
        if (payload.summaries) {
          const map: Record<string, Summary> = {};
          for (const s of payload.summaries as Summary[]) {
            map[s.summary_date] = s;
          }
          setSummaries(map);
        }
      })
      .catch(() => {});
  }, [year, month]);

  function changeMonth(delta: number) {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6 shadow-xs space-y-4">
      {/* Calendar Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
        <div>
          <h2 className="text-base font-bold text-[var(--foreground)]">Monthly Log Calendar</h2>
          <p className="text-xs text-[var(--ink-muted)]">Track your streak and daily meal consistency</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="active-press grid size-11 place-items-center rounded-lg text-xs font-bold text-[var(--foreground)] hover:bg-[var(--line)]"
              aria-label="Previous month"
            >
              ←
            </button>
            <span className="px-2 text-xs font-bold text-[var(--foreground)] min-w-[100px] text-center">
              {monthName}
            </span>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="active-press grid size-11 place-items-center rounded-lg text-xs font-bold text-[var(--foreground)] hover:bg-[var(--line)]"
              aria-label="Next month"
            >
              →
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
              <span className="grid size-5 place-items-center rounded-md border-2 border-[var(--leaf)] bg-[var(--surface)] text-[var(--leaf)]" aria-hidden="true">
                <IconCheck className="size-3 stroke-[3]" />
              </span>
              Target hit
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-[var(--leaf-light)] px-3 py-1 text-xs font-extrabold text-[var(--leaf-deep)] shadow-2xs">
            <IconFlame className="size-4 text-[var(--leaf)]" />
            <span className="tabular-nums">{currentStreak} Day Streak</span>
          </div>
        </div>
      </div>

      {/* Weekday Column Labels */}
      <div className="grid grid-cols-7 gap-1 text-center border-b border-[var(--line)]/40 pb-2">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day} className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            {day}
          </span>
        ))}
      </div>

      {/* Month Days Grid */}
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {monthDays.map((day, idx) => {
          if (!day.isCurrentMonth) {
            return (
              <div key={`blank-${idx}`} className="flex h-10 items-center justify-center opacity-30">
                <span className="tabular-nums text-xs text-[var(--ink-muted)]">{day.dayNumber}</span>
              </div>
            );
          }

          const summary = summaries[day.dateStr];
          const hasLogged = Boolean(summary?.logged_at_least_once);
          const hitTarget = Boolean(summary?.hit_target);

          return (
            <div
              key={day.dateStr}
              className={`flex h-10 flex-col items-center justify-center rounded-xl transition-all ${
                day.isToday
                  ? "ring-2 ring-[var(--leaf)] ring-offset-2 ring-offset-[var(--surface)] font-black"
                  : ""
              } ${
                hasLogged
                  ? "bg-[var(--leaf)] text-[var(--on-leaf)] shadow-2xs"
                  : "bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--line)]"
              }`}
              title={day.dateStr}
            >
              <span className="tabular-nums text-xs font-bold leading-none">{day.dayNumber}</span>
              {hasLogged && (
                <span className="mt-0.5">
                  {hitTarget ? <IconCheck className="size-3 stroke-[3]" /> : <IconFlame className="size-3" />}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
