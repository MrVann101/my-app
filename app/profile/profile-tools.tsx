"use client";

import { FormEvent, useEffect, useState } from "react";

type ProfileForm = {
  weightKg: string;
  heightCm: string;
  age: string;
  sex: "male" | "female";
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "lose" | "maintain" | "gain";
  timezone: string;
};

type TargetResult = {
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  safetyFloorApplied: boolean;
};

const initialForm: ProfileForm = {
  weightKg: "",
  heightCm: "",
  age: "",
  sex: "female",
  activityLevel: "moderate",
  goal: "maintain",
  timezone: "UTC",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(payload: unknown, fallback: string) {
  return isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string"
    ? payload.error.message
    : fallback;
}

export default function ProfileTools() {
  const [form, setForm] = useState<ProfileForm>(initialForm);
  const [targets, setTargets] = useState<TargetResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const response = await fetch("/api/profile");
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(getErrorMessage(payload, "Unable to load your goals and targets."));
        const profile = isRecord(payload) && isRecord(payload.profile) ? payload.profile : null;
        if (!profile || !active) return;
        setForm({
          weightKg: profile.weight_kg == null ? "" : String(profile.weight_kg),
          heightCm: profile.height_cm == null ? "" : String(profile.height_cm),
          age: profile.age == null ? "" : String(profile.age),
          sex: profile.sex === "male" ? "male" : "female",
          activityLevel: profile.activity_level === "sedentary"
            || profile.activity_level === "light"
            || profile.activity_level === "moderate"
            || profile.activity_level === "active"
            || profile.activity_level === "very_active"
            ? profile.activity_level
            : "moderate",
          goal: profile.goal === "lose" || profile.goal === "gain" ? profile.goal : "maintain",
          timezone: typeof profile.timezone === "string" ? profile.timezone : "UTC",
        });
        if (typeof profile.target_calories === "number") {
          setTargets({
            targetCalories: profile.target_calories,
            targetProteinG: Number(profile.target_protein_g ?? 0),
            targetCarbsG: Number(profile.target_carbs_g ?? 0),
            targetFatG: Number(profile.target_fat_g ?? 0),
            safetyFloorApplied: false,
          });
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load your goals and targets.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  function updateForm<K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveTargets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.set(key, value));
      const response = await fetch("/api/profile", { method: "POST", body });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(payload, "Unable to save your goals and targets."));
      if (!isRecord(payload) || !isRecord(payload.targets)) {
        throw new Error("Your profile was saved, but the updated targets could not be read.");
      }
      setTargets({
        targetCalories: Number(payload.targets.targetCalories),
        targetProteinG: Number(payload.targets.targetProteinG),
        targetCarbsG: Number(payload.targets.targetCarbsG),
        targetFatG: Number(payload.targets.targetFatG),
        safetyFloorApplied: payload.targets.safetyFloorApplied === true,
      });
      setMessage("Your body stats, goal, and daily targets have been updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save your goals and targets.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-[var(--ink-muted)]">Loading your goals and targets…</p>;
  }

  return (
    <form className="space-y-5" onSubmit={(event) => void saveTargets(event)}>
      <p className="text-sm leading-6 text-[var(--ink-muted)]">
        Update your body stats, activity level, and weight goal. Bitewise recalculates your daily calorie and macro targets from these details.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-semibold">
          Weight (kg)
          <input required type="number" min={1} max={700} step={0.1} value={form.weightKg} onChange={(event) => updateForm("weightKg", event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 font-normal" />
        </label>
        <label className="text-sm font-semibold">
          Height (cm)
          <input required type="number" min={1} max={300} step={1} value={form.heightCm} onChange={(event) => updateForm("heightCm", event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 font-normal" />
        </label>
        <label className="text-sm font-semibold">
          Age
          <input required type="number" min={13} max={120} step={1} value={form.age} onChange={(event) => updateForm("age", event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 font-normal" />
        </label>
        <label className="text-sm font-semibold">
          Sex used for calorie estimate
          <select value={form.sex} onChange={(event) => updateForm("sex", event.target.value as ProfileForm["sex"])} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 font-normal">
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Activity level
          <select value={form.activityLevel} onChange={(event) => updateForm("activityLevel", event.target.value as ProfileForm["activityLevel"])} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 font-normal">
            <option value="sedentary">Sedentary</option>
            <option value="light">Light (1–3 days/week)</option>
            <option value="moderate">Moderate (3–5 days/week)</option>
            <option value="active">Active (6–7 days/week)</option>
            <option value="very_active">Very active</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Goal
          <select value={form.goal} onChange={(event) => updateForm("goal", event.target.value as ProfileForm["goal"])} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 font-normal">
            <option value="lose">Lose weight</option>
            <option value="maintain">Maintain weight</option>
            <option value="gain">Gain weight</option>
          </select>
        </label>
      </div>
      {targets && (
        <div className="rounded-2xl border border-[var(--leaf)]/25 bg-[var(--leaf-light)] p-4">
          <p className="font-bold text-[var(--leaf-ink)]">Your daily targets</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <p><span className="block text-xs text-[var(--ink-muted)]">Calories</span><strong>{Math.round(targets.targetCalories).toLocaleString()} kcal</strong></p>
            <p><span className="block text-xs text-[var(--ink-muted)]">Protein</span><strong>{Math.round(targets.targetProteinG)} g</strong></p>
            <p><span className="block text-xs text-[var(--ink-muted)]">Carbs</span><strong>{Math.round(targets.targetCarbsG)} g</strong></p>
            <p><span className="block text-xs text-[var(--ink-muted)]">Fat</span><strong>{Math.round(targets.targetFatG)} g</strong></p>
          </div>
          {targets.safetyFloorApplied && <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">A minimum calorie safety floor was applied to this estimate.</p>}
        </div>
      )}
      {error && <p className="text-sm text-[var(--coral)]" role="alert">{error}</p>}
      {message && <p className="text-sm text-[var(--leaf-ink)]" role="status">{message}</p>}
      <button type="submit" disabled={isSubmitting} className="rounded-xl bg-[var(--leaf)] px-5 py-3 text-sm font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:opacity-50">
        {isSubmitting ? "Saving…" : "Save Goals & Targets"}
      </button>
      <p className="text-xs leading-5 text-[var(--ink-muted)]">These are general estimates for nutrition tracking, not medical advice.</p>
    </form>
  );
}
