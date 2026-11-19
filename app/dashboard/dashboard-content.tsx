"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { displayNutrient } from "@/lib/food";
import SuggestionsCard from "./suggestions-card";
import StreakCalendar from "@/components/streak-calendar";
import { IconLog } from "@/components/icons";
import { getBrowserTimezone } from "@/lib/date";
import FoodLogRow from "@/components/food-log-row";

type Dashboard = {
  timezone?: string;
  needsOnboarding?: boolean;
  targetCalories?: number;
  caloriesConsumed?: number;
  caloriesBurned?: number;
  caloriesRemaining?: number;
  macros?: {
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    sodiumMg: number;
    sugarG: number;
    targetProteinG: number;
    targetCarbsG: number;
    targetFatG: number;
  };
  streak?: { current_streak: number };
  logs?: { id: number; food_name: string; calories: number; meal_type: string; source: string; weight_g?: number; is_recipe?: boolean }[];
};

export default function DashboardContent() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    let midnightTimer: ReturnType<typeof setTimeout>;
    let timezone = getBrowserTimezone();

    function scheduleMidnightRefresh() {
      clearTimeout(midnightTimer);
      midnightTimer = setTimeout(() => void load(), millisecondsUntilNextDay(timezone));
    }

    async function load() {
      if (refreshing) return;
      refreshing = true;
      try {
        const response = await fetch(`/api/dashboard?timezone=${encodeURIComponent(timezone)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Unable to load dashboard.");
        if (!active) return;
        if (typeof payload.timezone === "string") timezone = payload.timezone;
        setData(payload);
        setError(null);
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load dashboard.");
      } finally {
        refreshing = false;
        if (active) scheduleMidnightRefresh();
      }
    }

    function refreshWhenActive() {
      if (document.visibilityState === "visible") void load();
    }

    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);
    void load();

    return () => {
      active = false;
      clearTimeout(midnightTimer);
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [refreshKey]);

  if (error)
    return (
      <div className="rounded-2xl border border-[var(--coral)]/30 bg-[var(--coral)]/10 p-5 text-sm font-medium text-[var(--coral)]" role="alert">
        {error}
      </div>
    );

  if (!data)
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-56 rounded-[2rem] bg-[var(--surface-muted)]" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
          <div className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
          <div className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
        </div>
        <div className="h-44 rounded-2xl bg-[var(--surface-muted)]" />
      </div>
    );

  if (data.needsOnboarding)
    return (
      <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-xs">
        <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">Finish setting your starting point</h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          We need a few stats to estimate your daily calorie and macro goals.
        </p>
        <Link
          className="active-press mt-6 inline-flex items-center justify-center rounded-xl bg-[var(--leaf)] px-6 py-3 text-sm font-semibold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)]"
          href="/onboarding"
        >
          Open Onboarding
        </Link>
      </div>
    );

  const target = data.targetCalories ?? 2000;
  const consumed = data.caloriesConsumed ?? 0;
  const burned = data.caloriesBurned ?? 0;
  const remaining = data.caloriesRemaining ?? 0;
  const progress = Math.min(100, Math.max(0, (consumed / target) * 100));
  const macros = data.macros!;

  const macroConfigs = [
    { label: "Protein", current: macros.proteinG, target: macros.targetProteinG, unit: "g", color: "bg-[var(--macro-protein)]", textColor: "text-[var(--leaf-ink)]", badgeStyle: "bg-[var(--leaf-light)] text-[var(--leaf-ink)] border-[var(--leaf)]/30", stroke: "var(--macro-protein)" },
    { label: "Carbs", current: macros.carbsG, target: macros.targetCarbsG, unit: "g", color: "bg-[var(--sun)]", textColor: "text-[var(--sun)]", badgeStyle: "bg-[var(--surface-muted)] text-[var(--foreground)] border-[var(--line)]", stroke: "var(--sun)" },
    { label: "Fat", current: macros.fatG, target: macros.targetFatG, unit: "g", color: "bg-[var(--coral)]", textColor: "text-[var(--coral)]", badgeStyle: "bg-[var(--coral)]/10 text-[var(--coral)] border-[var(--coral)]/30", stroke: "var(--coral)" },
  ];

  const microConfigs = [
    { label: "Fiber", current: macros.fiberG, unit: "g" },
    { label: "Sodium", current: macros.sodiumMg, unit: "mg" },
    { label: "Sugar", current: macros.sugarG, unit: "g" },
  ];

  return (
    <div className="space-y-6">
      {/* Primary Hero Card - Nordic Blue Gradient */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0369a1] via-[#0284c7] to-[#0ea5e9] p-6 text-white shadow-md sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-sky-100">Calories Remaining</p>
            <p className="tabular-nums mt-2 text-5xl font-extrabold tracking-tight sm:text-6xl text-white">
              {Math.round(remaining).toLocaleString()}
            </p>
            <p className="mt-2 text-xs font-medium text-sky-100">
              {Math.round(consumed).toLocaleString()} logged · {Math.round(burned).toLocaleString()} exercise credit
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-full border border-white/30 bg-white/15 px-3.5 py-1.5 backdrop-blur-xs">
            <span className={`size-2 rounded-full ${remaining >= 0 ? "bg-white animate-pulse" : "bg-red-300"}`} />
            <span className="text-xs font-bold tracking-wide text-white">
              {remaining >= 0 ? "On Track" : "Over Budget"}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative mt-8">
          <div className="flex items-center justify-between text-xs font-medium text-sky-100 mb-2">
            <span>{Math.round(progress)}% of daily target</span>
            <span className="tabular-nums">{Math.round(target).toLocaleString()} kcal target</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all duration-500 ease-out shadow-xs"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Streak Calendar Grid */}
      <StreakCalendar currentStreak={data.streak?.current_streak ?? 0} />

      {/* Macros Grid & Donut Diagram */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ink-muted)]">Macronutrient Ratio</h2>
        </div>

        {/* Donut Chart Circle Diagram Card */}
        {(() => {
          const totalMacroG = macros.proteinG + macros.carbsG + macros.fatG;
          const pPct = totalMacroG > 0 ? (macros.proteinG / totalMacroG) * 100 : 0;
          const cPct = totalMacroG > 0 ? (macros.carbsG / totalMacroG) * 100 : 0;
          const fPct = totalMacroG > 0 ? (macros.fatG / totalMacroG) * 100 : 0;

          return (
            <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-center gap-6 justify-between">
              <div className="flex flex-col sm:flex-row items-center gap-6 w-full justify-between">
                <div className="relative flex items-center justify-center shrink-0">
                  <svg
                    className="size-32 -rotate-90"
                    viewBox="0 0 100 100"
                    role="img"
                    aria-label={`Macro ratio: ${Math.round(macros.proteinG)} grams protein (${Math.round(pPct)}%), ${Math.round(macros.carbsG)} grams carbs (${Math.round(cPct)}%), and ${Math.round(macros.fatG)} grams fat (${Math.round(fPct)}%).`}
                  >
                    <circle cx="50" cy="50" r="38" stroke="var(--surface-muted)" strokeWidth="12" fill="none" />
                    {totalMacroG > 0 && (
                      <>
                        {/* Protein Segment */}
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          stroke="var(--leaf)"
                          strokeWidth="12"
                          fill="none"
                          strokeDasharray={`${(pPct * 2.38).toFixed(1)} 238`}
                          strokeDashoffset="0"
                        />
                        {/* Carbs Segment */}
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          stroke="var(--sun)"
                          strokeWidth="12"
                          fill="none"
                          strokeDasharray={`${(cPct * 2.38).toFixed(1)} 238`}
                          strokeDashoffset={`-${(pPct * 2.38).toFixed(1)}`}
                        />
                        {/* Fat Segment */}
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          stroke="var(--coral)"
                          strokeWidth="12"
                          fill="none"
                          strokeDasharray={`${(fPct * 2.38).toFixed(1)} 238`}
                          strokeDashoffset={`-${((pPct + cPct) * 2.38).toFixed(1)}`}
                        />
                      </>
                    )}
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-[10px] font-bold uppercase text-[var(--ink-muted)] block">Total</span>
                    <strong className="text-sm font-extrabold text-[var(--foreground)]">{Math.round(totalMacroG)}g</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full" aria-label="Macro amounts and ratio">
                  <div className="flex items-center justify-between gap-3 text-xs rounded-xl bg-[var(--leaf-light)] p-3 border border-[var(--leaf)]/30">
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-full bg-[var(--leaf)] shadow-2xs shrink-0" />
                      <span className="font-extrabold text-[var(--leaf-ink)]">Protein</span>
                    </div>
                    <span className="tabular-nums font-bold text-[var(--leaf-ink)]">
                      {Math.round(macros.proteinG)}g <span className="text-[10px] opacity-75">({Math.round(pPct)}%)</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs rounded-xl bg-[var(--surface-muted)] p-3 border border-[var(--line)]">
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-full bg-[var(--sun)] shadow-2xs shrink-0" />
                      <span className="font-extrabold text-[var(--foreground)]">Carbs</span>
                    </div>
                    <span className="tabular-nums font-bold text-[var(--foreground)]">
                      {Math.round(macros.carbsG)}g <span className="text-[10px] opacity-75">({Math.round(cPct)}%)</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs rounded-xl bg-[var(--coral)]/10 p-3 border border-[var(--coral)]/30">
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-full bg-[var(--coral)] shadow-2xs shrink-0" />
                      <span className="font-extrabold text-[var(--coral)]">Fat</span>
                    </div>
                    <span className="tabular-nums font-bold text-[var(--coral)]">
                      {Math.round(macros.fatG)}g <span className="text-[10px] opacity-75">({Math.round(fPct)}%)</span>
                    </span>
                  </div>
                </div>
                <div className="w-full overflow-x-auto sm:hidden">
                  <table className="w-full text-left text-xs">
                    <caption className="sr-only">Macro amounts and their share of today&apos;s total</caption>
                    <thead className="text-[var(--ink-muted)]">
                      <tr>
                        <th scope="col" className="pb-2 font-semibold">Macro</th>
                        <th scope="col" className="pb-2 text-right font-semibold">Amount</th>
                        <th scope="col" className="pb-2 text-right font-semibold">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Protein", macros.proteinG, pPct],
                        ["Carbs", macros.carbsG, cPct],
                        ["Fat", macros.fatG, fPct],
                      ].map(([label, amount, share]) => (
                        <tr key={label as string} className="border-t border-[var(--line)]">
                          <th scope="row" className="py-2 font-bold text-[var(--foreground)]">{label}</th>
                          <td className="tabular-nums py-2 text-right font-semibold">{Math.round(amount as number)}g</td>
                          <td className="tabular-nums py-2 text-right font-semibold">{Math.round(share as number)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="grid gap-3 sm:grid-cols-3">
          {macroConfigs.map((m) => {
            const pct = Math.min(100, Math.max(0, (m.current / m.target) * 100));
            return (
              <div
                key={m.label}
                className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${m.color}`} />
                    <span className="text-xs font-bold text-[var(--foreground)]">{m.label}</span>
                  </div>
                  <span className="text-xs font-medium text-[var(--ink-muted)]">Target: {Math.round(m.target)}{m.unit}</span>
                </div>
                <p className="tabular-nums mt-2 text-2xl font-extrabold text-[var(--foreground)]">
                  {displayNutrient(m.current, m.current > 0 ? "usda" : "manual", m.unit)}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div className={`h-full rounded-full ${m.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Micronutrients */}
      <div className="grid gap-3 sm:grid-cols-3">
        {microConfigs.map((m) => (
          <div key={m.label} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
            <span className="text-xs font-bold text-[var(--ink-muted)]">{m.label}</span>
            <p className="tabular-nums mt-1 text-xl font-extrabold text-[var(--foreground)]">
              {displayNutrient(m.current, m.current > 0 ? "usda" : "manual", m.unit)}
            </p>
          </div>
        ))}
      </div>

      {/* Today's Meals */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">Today&apos;s Meals</h2>
            <p className="text-xs text-[var(--ink-muted)]">Logged entries for today</p>
          </div>
        </div>

        {data.logs && data.logs.length > 0 ? (
          <div className="mt-4 divide-y divide-[var(--line)]/50">
            {data.logs.map((log) => (
              <FoodLogRow key={log.id} log={log} onChanged={() => setRefreshKey((key) => key + 1)} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--ink-muted)]">No meals logged yet today.</p>
            <Link
              href="/log"
              className="active-press mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--leaf)] px-4 py-2 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)]"
            >
              <IconLog className="size-4" />
              <span>Log Your First Meal</span>
            </Link>
          </div>
        )}
      </div>

      <SuggestionsCard />
    </div>
  );
}

function millisecondsUntilNextDay(timezone: string): number {
  const dateAt = (timestamp: number) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(timestamp));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };

  const now = Date.now();
  const today = dateAt(now);
  let lower = now;
  let upper = now + 36 * 60 * 60 * 1000;
  while (dateAt(upper) === today) upper += 24 * 60 * 60 * 1000;

  while (upper - lower > 1000) {
    const middle = Math.floor((lower + upper) / 2);
    if (dateAt(middle) === today) lower = middle;
    else upper = middle;
  }

  return Math.max(1000, upper - now);
}
