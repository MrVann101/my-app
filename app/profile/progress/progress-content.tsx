"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { getBrowserDate } from "@/lib/date";

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
  const [rangeDays, setRangeDays] = useState<7 | 30>(30);
  const [selectedCalories, setSelectedCalories] = useState<number | null>(null);
  const [selectedWeight, setSelectedWeight] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [weightInput, setWeightInput] = useState("");
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [weightStatus, setWeightStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const from = dateOffset(-29);
    const to = dateOffset(0);
    Promise.all([
      fetch(`/api/summaries?from=${from}&to=${to}`, { cache: "no-store" }).then((response) => response.json()),
      fetch(`/api/weight?from=${from}&to=${to}`, { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/profile", { cache: "no-store" }).then((response) => response.json()),
    ])
      .then(([summaryPayload, weightPayload, profilePayload]) => {
        if (!active) return;
        if (summaryPayload.error || weightPayload.error || profilePayload.error) {
          throw new Error(summaryPayload.error?.message ?? weightPayload.error?.message ?? profilePayload.error?.message);
        }
        const nextSummaries: Summary[] = summaryPayload.summaries ?? [];
        const nextWeights: Weight[] = weightPayload.logs ?? [];
        setSummaries(nextSummaries);
        setWeights(nextWeights);
        setSelectedCalories(nextSummaries.length > 0 ? nextSummaries.length - 1 : null);
        setSelectedWeight(nextWeights.length > 0 ? nextWeights.length - 1 : null);
        const target = Number(profilePayload.profile?.target_calories);
        setTargetCalories(Number.isFinite(target) && target > 0 ? target : null);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load progress.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const visibleSummaries = useMemo(
    () => (rangeDays === 7 ? summaries.slice(-7) : summaries),
    [summaries, rangeDays],
  );
  const visibleWeights = useMemo(
    () => (rangeDays === 7 ? weights.slice(-7) : weights),
    [weights, rangeDays],
  );

  async function handleWeightSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numeric = Number(weightInput);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 700) {
      setWeightError("Enter a valid weight between 1 and 700 kg.");
      return;
    }

    setWeightError(null);
    setWeightStatus(null);
    setIsSavingWeight(true);
    try {
      const response = await fetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate: getBrowserDate(),
          weightKg: Math.round(numeric * 10) / 10,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setWeightError(payload.error?.message ?? "Unable to save weigh-in.");
        return;
      }
      setWeightInput("");
      setWeightStatus(`Recorded today's weigh-in (${numeric.toFixed(1)} kg).`);
      setRefreshKey((key) => key + 1);
    } catch {
      setWeightError("Unable to reach Bitewise. Check your connection and try again.");
    } finally {
      setIsSavingWeight(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
          <div className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
        </div>
        <div className="h-60 rounded-2xl bg-[var(--surface-muted)]" />
        <div className="h-60 rounded-2xl bg-[var(--surface-muted)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] p-5 text-sm font-medium text-[var(--coral)]" role="alert">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsLoading(true);
            setRefreshKey((key) => key + 1);
          }}
          className="active-press mt-3 inline-flex min-h-11 items-center rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--foreground)]"
        >
          Try again
        </button>
      </div>
    );
  }

  const maxCalories = Math.max(...visibleSummaries.map((item) => Number(item.total_calories)), targetCalories ?? 1, 1);
  const latestWeight = weights.at(-1)?.weight_kg;
  const firstWeight = weights[0]?.weight_kg;

  const activeCalIdx = selectedCalories !== null && selectedCalories < visibleSummaries.length
    ? selectedCalories
    : visibleSummaries.length - 1;
  const activeWeightIdx = selectedWeight !== null && selectedWeight < visibleWeights.length
    ? selectedWeight
    : visibleWeights.length - 1;

  const selectedSummary = activeCalIdx >= 0 ? visibleSummaries[activeCalIdx] : undefined;
  const selectedWeightLog = activeWeightIdx >= 0 ? visibleWeights[activeWeightIdx] : undefined;

  const numericWeights = visibleWeights.map((item) => Number(item.weight_kg));
  const minWeight = numericWeights.length ? Math.min(...numericWeights) : 0;
  const maxWeight = numericWeights.length ? Math.max(...numericWeights) : 1;
  const axisMinWeight = Math.max(0, minWeight - 2);
  const axisSpanWeight = Math.max(1, maxWeight + 2 - axisMinWeight);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <p className="text-sm text-[var(--ink-muted)]">Latest weight</p>
          <p className="tabular-nums mt-2 text-3xl font-semibold">
            {latestWeight ? `${Number(latestWeight).toFixed(1)} kg` : "Not logged"}
          </p>
          {latestWeight && firstWeight && (
            <p className="tabular-nums mt-1 text-xs text-[var(--ink-muted)]">
              {(Number(latestWeight) - Number(firstWeight)) > 0 ? "+" : ""}
              {(Number(latestWeight) - Number(firstWeight)).toFixed(1)} kg since first check-in
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <p className="text-sm text-[var(--ink-muted)]">Logged days (30d)</p>
          <p className="tabular-nums mt-2 text-3xl font-semibold">
            {summaries.filter((item) => Number(item.total_calories) > 0).length}
            <span className="text-base font-normal text-[var(--ink-muted)]"> / 30</span>
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">Permanent daily summaries</p>
        </div>
      </div>

      {/* Weight Check-In Form (unblocks Weight Trend & Adaptive Recalibration) */}
      <section id="weight-checkin" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-[var(--foreground)]">Log Weight Check-In</h2>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              Record at least 3 check-ins over time to unlock Adaptive Recalibration.
            </p>
          </div>
          <span className="tabular-nums rounded-full bg-[var(--leaf-light)] px-3 py-1 text-xs font-bold text-[var(--leaf-ink)]">
            {weights.length} check-in{weights.length === 1 ? "" : "s"} (30d)
          </span>
        </div>

        <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleWeightSubmit}>
          <div className="flex-1">
            <label htmlFor="progress-weight-input" className="block text-xs font-semibold text-[var(--ink-muted)]">
              Today&apos;s weight (kg)
            </label>
            <input
              id="progress-weight-input"
              type="number"
              inputMode="decimal"
              min="1"
              max="700"
              step="0.1"
              placeholder={latestWeight ? `Last: ${Number(latestWeight).toFixed(1)} kg` : "e.g. 68.5"}
              value={weightInput}
              onChange={(event) => setWeightInput(event.target.value)}
              className="tabular-nums mt-1.5 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3.5 text-sm font-bold outline-none focus:border-[var(--leaf)]"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSavingWeight}
            className="active-press inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--leaf)] px-5 text-sm font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:opacity-50"
          >
            {isSavingWeight ? "Saving..." : "Log weigh-in"}
          </button>
        </form>
        {weightError && <p className="mt-2.5 text-xs font-semibold text-[var(--coral)]" role="alert">{weightError}</p>}
        {weightStatus && <p className="mt-2.5 text-xs font-semibold text-[var(--leaf)]" role="status">{weightStatus}</p>}
      </section>

      {/* Range Selector */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">Trend Window</p>
        <div className="inline-flex gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1" role="group" aria-label="Chart time range">
          {([7, 30] as const).map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={rangeDays === days}
              onClick={() => {
                setRangeDays(days);
                setSelectedCalories(null);
                setSelectedWeight(null);
              }}
              className={`active-press min-h-11 rounded-lg px-4 text-xs font-bold transition-colors ${
                rangeDays === days
                  ? "bg-[var(--leaf)] text-[var(--on-leaf)]"
                  : "text-[var(--ink-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      <ChartSection
        title="Daily calories"
        subtitle={`last ${rangeDays} days`}
        readout={
          selectedSummary
            ? `${selectedSummary.summary_date}: ${Math.round(Number(selectedSummary.total_calories)).toLocaleString()} kcal${
                targetCalories ? ` · target ${Math.round(targetCalories).toLocaleString()} kcal` : ""
              }`
            : "No calorie data yet."
        }
      >
        {visibleSummaries.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--ink-muted)]">Not enough summary data yet. Keep logging to build your trend.</p>
        ) : (
          <div className="mt-5">
            <div
              className="relative flex h-44 w-full items-end gap-1 border-b border-l border-[var(--line)] px-1 sm:gap-1.5"
              aria-label="Daily calories bar chart"
            >
              {targetCalories && (
                <div
                  className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--coral)]"
                  style={{ bottom: `${Math.min(100, (targetCalories / maxCalories) * 100)}%` }}
                >
                  <span className="absolute -top-5 right-1 rounded bg-[var(--surface)] px-1 text-[10px] font-semibold text-[var(--coral)]">
                    Target {Math.round(targetCalories)}
                  </span>
                </div>
              )}
              {visibleSummaries.map((item, index) => (
                <button
                  type="button"
                  className={`group flex h-full min-w-0 flex-1 items-end rounded-t-sm px-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--leaf)] ${
                    activeCalIdx === index ? "bg-[var(--leaf-light)]" : ""
                  }`}
                  key={item.summary_date}
                  onFocus={() => setSelectedCalories(index)}
                  onClick={() => setSelectedCalories(index)}
                  aria-label={`${item.summary_date}: ${Math.round(Number(item.total_calories))} kcal`}
                >
                  <span
                    className="w-full rounded-t-sm bg-[var(--leaf)] transition-opacity group-hover:opacity-75"
                    style={{ height: `${Math.max(4, (Number(item.total_calories) / maxCalories) * 100)}%` }}
                  />
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-[var(--ink-muted)]">
              <span>{visibleSummaries[0]?.summary_date}</span>
              <span>Tap a bar to inspect</span>
              <span>{visibleSummaries.at(-1)?.summary_date}</span>
            </div>
            <table className="sr-only">
              <caption>Daily calories for the last {rangeDays} days</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Calories</th>
                </tr>
              </thead>
              <tbody>
                {visibleSummaries.map((item) => (
                  <tr key={item.summary_date}>
                    <th scope="row">{item.summary_date}</th>
                    <td>{Math.round(Number(item.total_calories))} kcal</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartSection>

      <ChartSection
        title="Weight trend"
        subtitle={`last ${rangeDays} days`}
        readout={
          selectedWeightLog
            ? `${selectedWeightLog.log_date}: ${Number(selectedWeightLog.weight_kg).toFixed(1)} kg`
            : "No weight data yet."
        }
      >
        {visibleWeights.length < 2 ? (
          <p className="mt-4 text-sm text-[var(--ink-muted)]">
            Add at least two check-ins using the form above to see your weight trend.
          </p>
        ) : (
          <div className="mt-5">
            <div
              className="flex h-44 w-full items-end gap-1 border-b border-l border-[var(--line)] px-1 sm:gap-1.5"
              aria-label="Weight trend bar chart"
            >
              {visibleWeights.map((item, index) => {
                const heightPct = ((Number(item.weight_kg) - axisMinWeight) / axisSpanWeight) * 100;
                return (
                  <button
                    type="button"
                    className={`group flex h-full min-w-0 flex-1 items-end rounded-t-sm px-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--leaf)] ${
                      activeWeightIdx === index ? "bg-[var(--leaf-light)]" : ""
                    }`}
                    key={`${item.log_date}-${index}`}
                    onFocus={() => setSelectedWeight(index)}
                    onClick={() => setSelectedWeight(index)}
                    aria-label={`${item.log_date}: ${Number(item.weight_kg).toFixed(1)} kilograms`}
                  >
                    <span
                      className="w-full rounded-t-sm bg-[var(--sun)] transition-opacity group-hover:opacity-80"
                      style={{ height: `${Math.max(10, Math.min(100, heightPct))}%` }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-[var(--ink-muted)]">
              <span>{visibleWeights[0]?.log_date}</span>
              <span>Scale: {axisMinWeight.toFixed(1)}–{(axisMinWeight + axisSpanWeight).toFixed(1)} kg</span>
              <span>{visibleWeights.at(-1)?.log_date}</span>
            </div>
            <table className="sr-only">
              <caption>Weight check-ins for the last {rangeDays} days</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Weight</th>
                </tr>
              </thead>
              <tbody>
                {visibleWeights.map((item, idx) => (
                  <tr key={`${item.log_date}-${idx}`}>
                    <th scope="row">{item.log_date}</th>
                    <td>{Number(item.weight_kg).toFixed(1)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartSection>
    </div>
  );
}

function ChartSection({
  title,
  subtitle,
  readout,
  children,
}: {
  title: string;
  subtitle: string;
  readout: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-[var(--ink-muted)]">{subtitle}</span>
      </div>
      <p className="mt-3 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs font-medium text-[var(--foreground)]" aria-live="polite">
        Selected: {readout}
      </p>
      {children}
    </section>
  );
}
