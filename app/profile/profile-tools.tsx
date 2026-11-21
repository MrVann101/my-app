"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { calculateTargets } from "@/lib/calculations";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";

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
  const [initialWeight, setInitialWeight] = useState<string>("");
  const [recordWeighIn, setRecordWeighIn] = useState(true);
  const [savedTargets, setSavedTargets] = useState<TargetResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(getErrorMessage(payload, "Unable to load your goals and targets."));
        const profile = isRecord(payload) && isRecord(payload.profile) ? payload.profile : null;
        if (!profile || !active) return;
        const loadedWeight = profile.weight_kg == null ? "" : String(profile.weight_kg);
        const browserTz = getBrowserTimezone();
        setInitialWeight(loadedWeight);
        setForm({
          weightKg: loadedWeight,
          heightCm: profile.height_cm == null ? "" : String(profile.height_cm),
          age: profile.age == null ? "" : String(profile.age),
          sex: profile.sex === "male" ? "male" : "female",
          activityLevel:
            profile.activity_level === "sedentary" ||
            profile.activity_level === "light" ||
            profile.activity_level === "moderate" ||
            profile.activity_level === "active" ||
            profile.activity_level === "very_active"
              ? profile.activity_level
              : "moderate",
          goal: profile.goal === "lose" || profile.goal === "gain" ? profile.goal : "maintain",
          timezone: typeof profile.timezone === "string" && profile.timezone !== "UTC" ? profile.timezone : browserTz,
        });
        if (typeof profile.target_calories === "number") {
          setSavedTargets({
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

  const livePreview = useMemo(() => {
    const w = Number(form.weightKg);
    const h = Number(form.heightCm);
    const a = Number(form.age);
    if (!Number.isFinite(w) || !Number.isFinite(h) || !Number.isInteger(a)) return null;
    try {
      return calculateTargets({
        weightKg: w,
        heightCm: h,
        age: a,
        sex: form.sex,
        activityLevel: form.activityLevel,
        goal: form.goal,
        timezone: form.timezone || "UTC",
      });
    } catch {
      return null;
    }
  }, [form]);

  const displayedTargets = livePreview ?? savedTargets;
  const weightChanged = form.weightKg.trim() !== "" && form.weightKg !== initialWeight;

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

      let weighInSaved = false;
      const numericWeight = Number(form.weightKg);
      if (recordWeighIn && Number.isFinite(numericWeight) && numericWeight > 0) {
        const weightRes = await fetch("/api/weight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logDate: getBrowserDate(), weightKg: numericWeight }),
        });
        weighInSaved = weightRes.ok;
      }

      setInitialWeight(form.weightKg);
      setSavedTargets({
        targetCalories: Number(payload.targets.targetCalories),
        targetProteinG: Number(payload.targets.targetProteinG),
        targetCarbsG: Number(payload.targets.targetCarbsG),
        targetFatG: Number(payload.targets.targetFatG),
        safetyFloorApplied: payload.targets.safetyFloorApplied === true,
      });
      setMessage(
        weighInSaved
          ? "Body stats, daily targets, and today's weigh-in have been saved."
          : "Your body stats, goal, and daily targets have been updated.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save your goals and targets.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-16 rounded-xl bg-[var(--surface-muted)]" />
          <div className="h-16 rounded-xl bg-[var(--surface-muted)]" />
          <div className="h-16 rounded-xl bg-[var(--surface-muted)]" />
        </div>
        <div className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={(event) => void saveTargets(event)}>
      <p className="text-sm leading-6 text-[var(--ink-muted)]">
        Update your body stats, activity level, and weight goal. Bitewise previews and recalculates your daily calorie and macro targets automatically.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="block text-sm font-semibold" htmlFor="stats-weight">Weight (kg)</label>
          <input
            id="stats-weight"
            required
            type="number"
            inputMode="decimal"
            min={1}
            max={700}
            step={0.1}
            value={form.weightKg}
            onChange={(event) => updateForm("weightKg", event.target.value)}
            className="tabular-nums mt-2 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 font-normal outline-none focus:border-[var(--leaf)]"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold" htmlFor="stats-height">Height (cm)</label>
          <input
            id="stats-height"
            required
            type="number"
            inputMode="numeric"
            min={1}
            max={300}
            step={1}
            value={form.heightCm}
            onChange={(event) => updateForm("heightCm", event.target.value)}
            className="tabular-nums mt-2 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 font-normal outline-none focus:border-[var(--leaf)]"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold" htmlFor="stats-age">Age</label>
          <input
            id="stats-age"
            required
            type="number"
            inputMode="numeric"
            min={13}
            max={120}
            step={1}
            value={form.age}
            onChange={(event) => updateForm("age", event.target.value)}
            className="tabular-nums mt-2 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 font-normal outline-none focus:border-[var(--leaf)]"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold" htmlFor="stats-sex">Sex used for calorie estimate</label>
          <select
            id="stats-sex"
            value={form.sex}
            onChange={(event) => updateForm("sex", event.target.value as ProfileForm["sex"])}
            className="mt-2 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 font-normal outline-none focus:border-[var(--leaf)]"
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold" htmlFor="stats-activity">Activity level</label>
          <select
            id="stats-activity"
            value={form.activityLevel}
            onChange={(event) => updateForm("activityLevel", event.target.value as ProfileForm["activityLevel"])}
            className="mt-2 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 font-normal outline-none focus:border-[var(--leaf)]"
          >
            <option value="sedentary">Sedentary</option>
            <option value="light">Light (1–3 days/week)</option>
            <option value="moderate">Moderate (3–5 days/week)</option>
            <option value="active">Active (6–7 days/week)</option>
            <option value="very_active">Very active</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold" htmlFor="stats-goal">Goal</label>
          <select
            id="stats-goal"
            value={form.goal}
            onChange={(event) => updateForm("goal", event.target.value as ProfileForm["goal"])}
            className="mt-2 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 font-normal outline-none focus:border-[var(--leaf)]"
          >
            <option value="lose">Lose weight</option>
            <option value="maintain">Maintain weight</option>
            <option value="gain">Gain weight</option>
          </select>
        </div>
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-[var(--foreground)]">
        <input
          type="checkbox"
          className="size-4 accent-[var(--leaf)]"
          checked={recordWeighIn}
          onChange={(event) => setRecordWeighIn(event.target.checked)}
        />
        <span>
          Also record {form.weightKg ? `${form.weightKg} kg` : "current weight"} as today&apos;s weigh-in
          {weightChanged ? " (updates Adaptive Recalibration)" : ""}
        </span>
      </label>

      {displayedTargets && (
        <div className="rounded-2xl border border-[var(--leaf)]/25 bg-[var(--leaf-light)] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-[var(--leaf-ink)]">
              {livePreview ? "Estimated daily targets (live preview)" : "Your daily targets"}
            </p>
            <span className="text-xs text-[var(--leaf-ink)]">TZ: {form.timezone}</span>
          </div>
          <div className="tabular-nums mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <p><span className="block text-xs text-[var(--leaf-ink)]/80">Calories</span><strong>{Math.round(displayedTargets.targetCalories).toLocaleString()} kcal</strong></p>
            <p><span className="block text-xs text-[var(--leaf-ink)]/80">Protein</span><strong>{Math.round(displayedTargets.targetProteinG)} g</strong></p>
            <p><span className="block text-xs text-[var(--leaf-ink)]/80">Carbs</span><strong>{Math.round(displayedTargets.targetCarbsG)} g</strong></p>
            <p><span className="block text-xs text-[var(--leaf-ink)]/80">Fat</span><strong>{Math.round(displayedTargets.targetFatG)} g</strong></p>
          </div>
          {displayedTargets.safetyFloorApplied && (
            <p className="mt-3 text-xs leading-5 text-[var(--leaf-ink)]">
              A minimum calorie safety floor was applied to this estimate.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm font-medium text-[var(--coral)]" role="alert">{error}</p>}
      {message && <p className="text-sm font-medium text-[var(--leaf)]" role="status">{message}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="active-press min-h-11 rounded-xl bg-[var(--leaf)] px-5 py-3 text-sm font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:opacity-50"
      >
        {isSubmitting ? "Saving…" : "Save Goals & Targets"}
      </button>
      <p className="text-xs leading-5 text-[var(--ink-muted)]">These are general estimates for nutrition tracking, not medical advice.</p>
    </form>
  );
}
