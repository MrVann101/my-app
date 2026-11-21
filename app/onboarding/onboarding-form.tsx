"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

const fields = [
  { name: "weightKg", label: "Weight (kg)", type: "number", inputMode: "decimal" as const, min: "1", max: "700", step: "0.1" },
  { name: "heightCm", label: "Height (cm)", type: "number", inputMode: "numeric" as const, min: "1", max: "300", step: "1" },
  { name: "age", label: "Age", type: "number", inputMode: "numeric" as const, min: "13", max: "120", step: "1" },
];

export default function OnboardingForm() {
  const [timezone, setTimezone] = useState("UTC");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    targetCalories: number;
    targetProteinG?: number;
    targetCarbsG?: number;
    targetFatG?: number;
    safetyFloorApplied: boolean;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setIsSubmitting(true);

    try {
      const body = new FormData(event.currentTarget);
      body.set("timezone", timezone);

      const response = await fetch("/api/profile", { method: "POST", body });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to save your profile.");
        return;
      }

      setResult(payload.targets);
    } catch {
      setError("Unable to reach Bitewise. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-5 sm:grid-cols-3">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium" htmlFor={`onboard-${field.name}`}>
              {field.label}
            </label>
            <input
              id={`onboard-${field.name}`}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]"
              name={field.name}
              type={field.type}
              inputMode={field.inputMode}
              min={field.min}
              max={field.max}
              step={field.step}
              required
            />
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="onboard-sex">Sex used for calorie estimate</label>
        <select
          id="onboard-sex"
          className="mt-2 h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]"
          name="sex"
          defaultValue="female"
          required
        >
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="onboard-activity">Activity level</label>
        <select
          id="onboard-activity"
          className="mt-2 h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]"
          name="activityLevel"
          defaultValue="moderate"
          required
        >
          <option value="sedentary">Sedentary</option>
          <option value="light">Light (1-3 days/week)</option>
          <option value="moderate">Moderate (3-5 days/week)</option>
          <option value="active">Active (6-7 days/week)</option>
          <option value="very_active">Very active</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="onboard-goal">Goal</label>
        <select
          id="onboard-goal"
          className="mt-2 h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]"
          name="goal"
          defaultValue="lose"
          required
        >
          <option value="lose">Lose weight</option>
          <option value="maintain">Maintain weight</option>
          <option value="gain">Gain weight</option>
        </select>
      </div>

      <p className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-xs leading-5 text-[var(--ink-muted)]">
        Timezone detected automatically: <strong className="font-medium text-[var(--foreground)]">{timezone}</strong>.
      </p>

      {error && <p className="text-sm font-medium text-[var(--coral)]" role="alert">{error}</p>}

      {result ? (
        <div className="space-y-4 rounded-2xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-5 text-[var(--leaf-ink)]" role="status">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Starting daily target</p>
            <p className="tabular-nums mt-1 text-2xl font-extrabold">{result.targetCalories.toLocaleString()} kcal/day</p>
            {typeof result.targetProteinG === "number" && (
              <p className="tabular-nums mt-1 text-xs font-semibold">
                Protein {Math.round(result.targetProteinG)}g · Carbs {Math.round(result.targetCarbsG ?? 0)}g · Fat {Math.round(result.targetFatG ?? 0)}g
              </p>
            )}
            {result.safetyFloorApplied && (
              <p className="mt-1.5 text-xs leading-5">
                We applied the minimum safety floor for your selected estimate.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/dashboard"
              className="active-press inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--leaf)] px-5 text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)]"
            >
              Go to my Dashboard →
            </Link>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="active-press inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
            >
              Edit stats
            </button>
          </div>
        </div>
      ) : (
        <button
          className="active-press h-12 w-full rounded-xl bg-[var(--leaf)] font-semibold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:cursor-wait disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Saving your starting point..." : "Calculate targets & continue"}
        </button>
      )}
    </form>
  );
}
