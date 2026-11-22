"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { displayNutrient } from "@/lib/food";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";
import Dialog from "@/components/dialog";
import FoodLogRow from "@/components/food-log-row";
import StreakCalendar from "@/components/streak-calendar";
import Badges from "./badges";
import SuggestionsCard from "./suggestions-card";
import {
  IconLog,
  IconHistory,
  IconCoffee,
  IconSun,
  IconUtensils,
  IconSnack,
  IconPlus,
  IconZap,
  IconX,
} from "@/components/icons";

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
  logs?: {
    id: number;
    food_name: string;
    calories: number;
    meal_type: string;
    source: string;
    weight_g?: number;
    is_recipe?: boolean;
  }[];
};

const DONUT_RADIUS = 38;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export default function DashboardContent() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [activityName, setActivityName] = useState("");
  const [caloriesBurnedInput, setCaloriesBurnedInput] = useState("");
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [isSavingExercise, setIsSavingExercise] = useState(false);

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

  async function handleSaveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const burnedValue = Number(caloriesBurnedInput);
    if (!activityName.trim() || !Number.isFinite(burnedValue) || burnedValue <= 0 || burnedValue > 10000) {
      setExerciseError("Enter an activity name and calories burned between 1 and 10,000.");
      return;
    }

    setExerciseError(null);
    setIsSavingExercise(true);
    try {
      const response = await fetch("/api/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate: getBrowserDate(),
          activityName: activityName.trim(),
          caloriesBurned: Math.round(burnedValue),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setExerciseError(payload.error?.message ?? "Unable to log exercise.");
        return;
      }
      setActivityName("");
      setCaloriesBurnedInput("");
      setShowExerciseModal(false);
      setRefreshKey((key) => key + 1);
    } catch {
      setExerciseError("Unable to reach Bitewise. Check your connection and try again.");
    } finally {
      setIsSavingExercise(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] p-5 text-sm font-medium text-[var(--coral)]" role="alert">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setRefreshKey((key) => key + 1);
          }}
          className="active-press mt-3 inline-flex min-h-11 items-center rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="h-56 rounded-[2rem] bg-[var(--surface-muted)] lg:col-span-7" />
          <div className="h-56 rounded-[2rem] bg-[var(--surface-muted)] lg:col-span-5" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          <div className="h-80 rounded-2xl bg-[var(--surface-muted)] lg:col-span-7" />
          <div className="space-y-3 lg:col-span-5">
            <div className="h-32 rounded-2xl bg-[var(--surface-muted)]" />
            <div className="h-16 rounded-2xl bg-[var(--surface-muted)]" />
            <div className="h-20 rounded-2xl bg-[var(--surface-muted)]" />
          </div>
        </div>
      </div>
    );
  }

  if (data.needsOnboarding) {
    return (
      <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-xs">
        <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">Finish setting your starting point</h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          We need a few stats to estimate your daily calorie and macro goals.
        </p>
        <Link
          className="active-press mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--leaf)] px-6 py-3 text-sm font-semibold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)]"
          href="/onboarding"
        >
          Open Onboarding
        </Link>
      </div>
    );
  }

  const target = data.targetCalories ?? 2000;
  const consumed = data.caloriesConsumed ?? 0;
  const burned = data.caloriesBurned ?? 0;
  const remaining = data.caloriesRemaining ?? 0;
  const progress = Math.min(100, Math.max(0, (consumed / target) * 100));
  const isOverBudget = remaining < 0;
  const macros = data.macros!;

  const totalMacroG = macros.proteinG + macros.carbsG + macros.fatG;
  const pPct = totalMacroG > 0 ? (macros.proteinG / totalMacroG) * 100 : 0;
  const cPct = totalMacroG > 0 ? (macros.carbsG / totalMacroG) * 100 : 0;
  const fPct = totalMacroG > 0 ? (macros.fatG / totalMacroG) * 100 : 0;

  const macroConfigs = [
    {
      label: "Protein",
      current: macros.proteinG,
      target: macros.targetProteinG,
      sharePct: pPct,
      unit: "g",
      dotStyle: { backgroundColor: "var(--macro-protein)" },
      barStyle: { backgroundColor: "var(--macro-protein)" },
    },
    {
      label: "Carbs",
      current: macros.carbsG,
      target: macros.targetCarbsG,
      sharePct: cPct,
      unit: "g",
      dotStyle: { backgroundColor: "var(--macro-carbs)" },
      barStyle: { backgroundColor: "var(--macro-carbs)" },
    },
    {
      label: "Fat",
      current: macros.fatG,
      target: macros.targetFatG,
      sharePct: fPct,
      unit: "g",
      dotStyle: { backgroundColor: "var(--macro-fat)" },
      barStyle: { backgroundColor: "var(--macro-fat)" },
    },
  ];

  const microConfigs = [
    { label: "Fiber", current: macros.fiberG, unit: "g" },
    { label: "Sodium", current: macros.sodiumMg, unit: "mg" },
    { label: "Sugar", current: macros.sugarG, unit: "g" },
  ];

  const mealSlots = [
    { key: "breakfast", label: "Breakfast", icon: IconCoffee },
    { key: "lunch", label: "Lunch", icon: IconSun },
    { key: "dinner", label: "Dinner", icon: IconUtensils },
    { key: "snack", label: "Snacks", icon: IconSnack },
  ] as const;

  const logs = data.logs ?? [];
  const groupedLogs = mealSlots.map((slot) => {
    const items = logs.filter(
      (l) =>
        (l.meal_type ?? "").toLowerCase() === slot.key ||
        (slot.key === "snack" && (l.meal_type ?? "").toLowerCase() === "snacks"),
    );
    const subtotal = items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
    return { ...slot, items, subtotal };
  });

  const recognizedTypes = ["breakfast", "lunch", "dinner", "snack", "snacks"];
  const otherItems = logs.filter((l) => !recognizedTypes.includes((l.meal_type ?? "").toLowerCase()));

  const pDash = (pPct / 100) * DONUT_CIRCUMFERENCE;
  const cDash = (cPct / 100) * DONUT_CIRCUMFERENCE;
  const fDash = (fPct / 100) * DONUT_CIRCUMFERENCE;

  return (
    <>
      <div className="space-y-6">
        {/* Row 1: Primary Daily Overview */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-stretch">
          {/* 1. Primary Calorie Hero Card */}
          <section className="relative flex flex-col justify-between overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--hero-from)] via-[var(--hero-via)] to-[var(--hero-to)] p-6 text-white shadow-md sm:p-7 lg:col-span-7">
            <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/10 blur-2xl" />

            <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#e5f2ea]">
                  {isOverBudget ? "Calories Over Budget" : "Calories Remaining"}
                </p>
                <p className="tabular-nums mt-2 text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
                  {Math.abs(Math.round(remaining)).toLocaleString()}
                </p>
                <p className="mt-2 text-xs font-medium text-[#e5f2ea]">
                  {Math.round(consumed).toLocaleString()} logged · {Math.round(burned).toLocaleString()} exercise credit
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start">
                <div className="flex items-center gap-2 rounded-full border border-white/30 bg-black/15 px-3.5 py-1.5">
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${isOverBudget ? "bg-[#fca5a5]" : "bg-[#bbf7d0] animate-pulse"}`}
                  />
                  <span className="text-xs font-bold tracking-wide text-white">
                    {isOverBudget ? "Over Budget" : "On Track"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExerciseError(null);
                    setShowExerciseModal(true);
                  }}
                  className="active-press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/35 bg-black/20 px-3.5 text-xs font-bold text-white transition-colors hover:bg-black/30"
                >
                  <IconZap className="size-3.5" />
                  <span>Log exercise</span>
                </button>
              </div>
            </div>

            <div className="relative mt-6">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-[#e5f2ea]">
                <span>{Math.round(progress)}% of daily target</span>
                <span className="tabular-nums">{Math.round(target).toLocaleString()} kcal target</span>
              </div>
              <div
                role="progressbar"
                aria-label="Daily calorie progress"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2.5 overflow-hidden rounded-full bg-black/25"
              >
                <div
                  className="h-full w-full origin-left rounded-full bg-white shadow-xs transition-transform duration-500 ease-out"
                  style={{ transform: `scaleX(${progress / 100})` }}
                />
              </div>
            </div>
          </section>

          {/* 2. Unified Macros & Micronutrients Card */}
          <section className="flex flex-col justify-between rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs lg:col-span-5">
            <div>
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ink-muted)]">Macros Today</h2>
                <span className="tabular-nums text-xs font-semibold text-[var(--ink-muted)]">
                  {Math.round(totalMacroG)}g total
                </span>
              </div>

              <div className="mt-3.5 flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative flex shrink-0 items-center justify-center">
                  <svg
                    className="size-24 -rotate-90"
                    viewBox="0 0 100 100"
                    role="img"
                    aria-label={`Macro ratio: ${Math.round(macros.proteinG)} grams protein (${Math.round(pPct)}%), ${Math.round(macros.carbsG)} grams carbs (${Math.round(cPct)}%), and ${Math.round(macros.fatG)} grams fat (${Math.round(fPct)}%).`}
                  >
                    <circle cx="50" cy="50" r={DONUT_RADIUS} stroke="var(--surface-muted)" strokeWidth="12" fill="none" />
                    {totalMacroG > 0 && (
                      <>
                        <circle
                          cx="50"
                          cy="50"
                          r={DONUT_RADIUS}
                          stroke="var(--macro-protein)"
                          strokeWidth="12"
                          fill="none"
                          strokeDasharray={`${pDash.toFixed(2)} ${DONUT_CIRCUMFERENCE.toFixed(2)}`}
                          strokeDashoffset="0"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r={DONUT_RADIUS}
                          stroke="var(--macro-carbs)"
                          strokeWidth="12"
                          fill="none"
                          strokeDasharray={`${cDash.toFixed(2)} ${DONUT_CIRCUMFERENCE.toFixed(2)}`}
                          strokeDashoffset={`-${pDash.toFixed(2)}`}
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r={DONUT_RADIUS}
                          stroke="var(--macro-fat)"
                          strokeWidth="12"
                          fill="none"
                          strokeDasharray={`${fDash.toFixed(2)} ${DONUT_CIRCUMFERENCE.toFixed(2)}`}
                          strokeDashoffset={`-${(pDash + cDash).toFixed(2)}`}
                        />
                      </>
                    )}
                  </svg>
                  <div className="absolute text-center">
                    <span className="block text-[10px] font-bold uppercase text-[var(--ink-muted)]">Total</span>
                    <strong className="tabular-nums text-xs font-extrabold text-[var(--foreground)]">{Math.round(totalMacroG)}g</strong>
                  </div>
                </div>

                <div className="w-full space-y-2.5">
                  {macroConfigs.map((m) => {
                    const pct = m.target > 0 ? Math.min(100, Math.max(0, (m.current / m.target) * 100)) : 0;
                    return (
                      <div key={m.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-1.5 font-bold text-[var(--foreground)]">
                            <span className="size-2.5 rounded-full" style={m.dotStyle} aria-hidden="true" />
                            <span>{m.label}</span>
                            <span className="tabular-nums font-medium text-[var(--ink-muted)]">({Math.round(m.sharePct)}%)</span>
                          </span>
                          <span className="tabular-nums font-bold text-[var(--foreground)]">
                            {Math.round(m.current)}
                            <span className="font-normal text-[var(--ink-muted)]"> / {Math.round(m.target)}{m.unit}</span>
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`${m.label} progress`}
                          aria-valuenow={Math.round(pct)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"
                        >
                          <div
                            className="h-full w-full origin-left rounded-full transition-transform duration-500 ease-out"
                            style={{ ...m.barStyle, transform: `scaleX(${pct / 100})` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <table className="sr-only">
              <caption>Macro amounts and their share of today&apos;s total</caption>
              <thead>
                <tr>
                  <th scope="col">Macro</th>
                  <th scope="col">Logged</th>
                  <th scope="col">Target</th>
                  <th scope="col">Share</th>
                </tr>
              </thead>
              <tbody>
                {macroConfigs.map((m) => (
                  <tr key={m.label}>
                    <th scope="row">{m.label}</th>
                    <td>{Math.round(m.current)}g</td>
                    <td>{Math.round(m.target)}g</td>
                    <td>{Math.round(m.sharePct)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-3">
              {microConfigs.map((m) => (
                <div key={m.label} className="rounded-xl bg-[var(--surface-muted)] px-2.5 py-1.5">
                  <span className="block text-[11px] font-semibold text-[var(--ink-muted)]">{m.label}</span>
                  <p className="tabular-nums mt-0.5 text-xs font-extrabold text-[var(--foreground)]">
                    {displayNutrient(m.current, m.current > 0 ? "usda" : "manual", m.unit)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Row 2: Primary Workspace + Compact Secondary Rail */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* 3. Today's Meals */}
          <section className="space-y-4 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ink-muted)]">Today&apos;s Meals</h2>
              <div className="flex items-center gap-2">
                <Link
                  href="/history"
                  className="active-press inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--leaf)] hover:text-[var(--foreground)]"
                >
                  <IconHistory className="size-4" />
                  <span>History</span>
                </Link>
                <Link
                  href="/log"
                  className="active-press inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--leaf)] px-4 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)]"
                >
                  <IconLog className="size-4" />
                  <span>Quick Log</span>
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {groupedLogs.map((slot) => {
                const SlotIcon = slot.icon;
                return (
                  <div
                    key={slot.key}
                    className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-[var(--line)]/60 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="grid size-9 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--leaf)]">
                            <SlotIcon className="size-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[var(--foreground)]">{slot.label}</h3>
                            <p className="text-[11px] text-[var(--ink-muted)]">
                              {slot.items.length} {slot.items.length === 1 ? "item" : "items"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-sm font-extrabold text-[var(--foreground)]">
                            {Math.round(slot.subtotal)} kcal
                          </span>
                          <Link
                            href={`/log?tab=search&meal=${slot.key}`}
                            aria-label={`Log ${slot.label}`}
                            className="active-press grid size-11 place-items-center rounded-xl border border-[var(--border-control)] text-[var(--leaf)] transition-colors hover:border-[var(--leaf)] hover:bg-[var(--leaf-light)]"
                          >
                            <IconPlus className="size-4" />
                          </Link>
                        </div>
                      </div>

                      {slot.items.length > 0 ? (
                        <div className="mt-2 divide-y divide-[var(--line)]/40">
                          {slot.items.map((log) => (
                            <FoodLogRow key={log.id} log={log} onChanged={() => setRefreshKey((key) => key + 1)} />
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center justify-between rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-muted)]/50 px-3 py-2 text-xs text-[var(--ink-muted)]">
                          <span>No {slot.label.toLowerCase()} logged</span>
                          <Link
                            href={`/log?tab=search&meal=${slot.key}`}
                            className="inline-flex min-h-11 items-center gap-1 px-2 font-semibold text-[var(--leaf)] hover:underline"
                          >
                            <IconPlus className="size-3.5" />
                            <span>Add</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {otherItems.length > 0 && (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">Other Logged Foods</h3>
                <div className="divide-y divide-[var(--line)]/40">
                  {otherItems.map((log) => (
                    <FoodLogRow key={log.id} log={log} onChanged={() => setRefreshKey((key) => key + 1)} />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 4. Secondary/Tertiary Right Rail: Compact Streak, Meal Ideas, Achievements */}
          <aside aria-label="Consistency, meal ideas, and achievements" className="space-y-3 lg:col-span-5">
            <StreakCalendar currentStreak={data.streak?.current_streak ?? 0} />
            <SuggestionsCard />
            <Badges />
          </aside>
        </div>
      </div>

      <Dialog
        open={showExerciseModal}
        onClose={() => {
          if (!isSavingExercise) setShowExerciseModal(false);
        }}
        titleId="exercise-modal-title"
        closeOnScrim={!isSavingExercise}
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <h2 id="exercise-modal-title" className="text-base font-bold text-[var(--foreground)]">
            Log Exercise Credit
          </h2>
          <button
            type="button"
            aria-label="Close exercise modal"
            disabled={isSavingExercise}
            onClick={() => setShowExerciseModal(false)}
            className="active-press grid size-11 place-items-center rounded-xl text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          >
            <IconX className="size-4" />
          </button>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleSaveExercise}>
          <div>
            <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]" htmlFor="exercise-activity">
              Activity
            </label>
            <input
              id="exercise-activity"
              className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 text-sm font-semibold outline-none focus:border-[var(--leaf)]"
              placeholder="e.g. 30-min brisk walk, cycling"
              maxLength={200}
              value={activityName}
              onChange={(event) => setActivityName(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]" htmlFor="exercise-kcal">
              Calories burned (kcal)
            </label>
            <input
              id="exercise-kcal"
              className="tabular-nums mt-1.5 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 text-sm font-bold outline-none focus:border-[var(--leaf)]"
              type="number"
              inputMode="numeric"
              min="1"
              max="10000"
              step="1"
              placeholder="e.g. 220"
              value={caloriesBurnedInput}
              onChange={(event) => setCaloriesBurnedInput(event.target.value)}
              required
            />
          </div>

          {exerciseError && (
            <p className="rounded-xl bg-[var(--coral-soft)] p-3 text-xs font-semibold text-[var(--coral)]" role="alert">
              {exerciseError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled={isSavingExercise}
              onClick={() => setShowExerciseModal(false)}
              className="active-press min-h-11 rounded-xl border border-[var(--border-control)] text-sm font-bold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingExercise}
              className="active-press min-h-11 rounded-xl bg-[var(--leaf)] text-sm font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:opacity-50"
            >
              {isSavingExercise ? "Saving..." : "Save Exercise"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
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
