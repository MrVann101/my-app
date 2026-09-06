"use client";

import { FormEvent, useEffect, useState } from "react";

const fields = [
  { name: "weightKg", label: "Weight (kg)", type: "number", min: "1", max: "700", step: "0.1" },
  { name: "heightCm", label: "Height (cm)", type: "number", min: "1", max: "300", step: "1" },
  { name: "age", label: "Age", type: "number", min: "13", max: "120", step: "1" },
];

export default function OnboardingForm() {
  const [timezone, setTimezone] = useState("UTC");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ targetCalories: number; safetyFloorApplied: boolean } | null>(null);
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
    const body = new FormData(event.currentTarget);
    body.set("timezone", timezone);

    const response = await fetch("/api/profile", { method: "POST", body });
    const payload = await response.json();
    setIsSubmitting(false);

    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to save your profile.");
      return;
    }

    setResult(payload.targets);
  }

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-5 sm:grid-cols-3">
        {fields.map((field) => <label className="block text-sm font-medium" key={field.name}>{field.label}<input className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]" name={field.name} type={field.type} min={field.min} max={field.max} step={field.step} required /></label>)}
      </div>
      <label className="block text-sm font-medium">Sex used for calorie estimate<select className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]" name="sex" defaultValue="female" required><option value="female">Female</option><option value="male">Male</option></select></label>
      <label className="block text-sm font-medium">Activity level<select className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]" name="activityLevel" defaultValue="moderate" required><option value="sedentary">Sedentary</option><option value="light">Light (1-3 days/week)</option><option value="moderate">Moderate (3-5 days/week)</option><option value="active">Active (6-7 days/week)</option><option value="very_active">Very active</option></select></label>
      <label className="block text-sm font-medium">Goal<select className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]" name="goal" defaultValue="lose" required><option value="lose">Lose weight</option><option value="maintain">Maintain weight</option><option value="gain">Gain weight</option></select></label>
      <p className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-xs leading-5 text-[var(--ink-muted)]">Timezone detected automatically: <strong className="font-medium text-[var(--foreground)]">{timezone}</strong>. You do not need to choose it manually.</p>
      {error && <p className="text-sm text-[var(--coral)]" role="alert">{error}</p>}
      {result && <div className="rounded-2xl border border-[#c9dfc9] bg-[#eef7ee] p-4 text-sm text-[var(--leaf-deep)]" role="status"><strong className="font-semibold">Starting target: {result.targetCalories.toLocaleString()} kcal/day.</strong>{result.safetyFloorApplied && <p className="mt-1 text-xs leading-5">We applied the minimum safety floor for your selected estimate.</p>}</div>}
      <button className="h-12 w-full rounded-xl bg-[var(--leaf)] font-semibold text-white hover:bg-[var(--leaf-deep)] disabled:cursor-wait disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? "Saving your starting point..." : "Continue to Bitewise"}</button>
    </form>
  );
}
