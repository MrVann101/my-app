"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Recommendation = {
  recommendedCalories: number;
  actualWeeklyChangeKg: number;
  expectedWeeklyChangeKg: number;
  direction: "increase" | "decrease" | "none";
};
type Payload = {
  eligible: boolean;
  checkins: number;
  requiredCheckins: number;
  recommendation?: Recommendation;
};

export default function RecalibrationCard() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/recalibration", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <section className="animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="h-4 w-32 rounded bg-[var(--surface-muted)]" />
        <div className="mt-3 h-4 w-full rounded bg-[var(--surface-muted)]" />
        <div className="mt-2 h-4 w-2/3 rounded bg-[var(--surface-muted)]" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-[var(--coral)]/30 bg-[var(--surface)] p-5" role="alert">
        <p className="font-semibold text-[var(--coral)]">Unable to load recalibration</p>
        <button
          className="active-press mt-3 min-h-11 rounded-xl border border-[var(--border-control)] px-4 text-sm font-semibold hover:bg-[var(--surface-muted)]"
          onClick={() => void load()}
          type="button"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!data?.eligible || !data.recommendation) {
    return (
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="font-semibold text-[var(--foreground)]">Adaptive recalibration</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          {data?.checkins ?? 0} of {data?.requiredCheckins ?? 3} weigh-ins recorded — log weight check-ins to unlock adaptive calorie recalibration.
        </p>
        <Link
          className="active-press mt-4 inline-flex min-h-11 items-center rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] px-4 text-sm font-semibold text-[var(--leaf)] hover:border-[var(--leaf)]"
          href="/profile/progress#weight-checkin"
        >
          Log a weigh-in →
        </Link>
      </section>
    );
  }

  const { recommendation } = data;

  async function respond(action: "accepted" | "dismissed") {
    setActionError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/recalibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, recommendedCalories: recommendation.recommendedCalories }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setActionError(payload?.error?.message ?? "Unable to save your response.");
        return;
      }
      setMessage(action === "accepted" ? "Recommendation applied to your daily target." : "Recommendation dismissed.");
    } catch {
      setActionError("Unable to reach Bitewise. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--leaf)]/30 bg-[var(--surface)] p-5">
      <h2 className="font-semibold text-[var(--foreground)]">Target check-in</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
        Your recent weight trend differs from the expected pace. Consider a target of{" "}
        <strong className="tabular-nums text-[var(--foreground)]">{Math.round(recommendation.recommendedCalories).toLocaleString()} kcal/day</strong>.
      </p>
      <p className="tabular-nums mt-2 text-xs text-[var(--ink-muted)]">
        Actual trend: {recommendation.actualWeeklyChangeKg.toFixed(2)} kg/week · expected: {recommendation.expectedWeeklyChangeKg.toFixed(2)} kg/week
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          disabled={isSubmitting}
          className="active-press min-h-11 rounded-xl bg-[var(--leaf)] px-4 text-sm font-semibold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:opacity-50"
          onClick={() => void respond("accepted")}
          type="button"
        >
          {isSubmitting ? "Saving..." : "Use suggestion"}
        </button>
        <button
          disabled={isSubmitting}
          className="active-press min-h-11 rounded-xl border border-[var(--border-control)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
          onClick={() => void respond("dismissed")}
          type="button"
        >
          Dismiss
        </button>
      </div>
      {actionError && <p className="mt-3 text-sm font-medium text-[var(--coral)]" role="alert">{actionError}</p>}
      {message && <p className="mt-3 text-sm font-medium text-[var(--leaf)]" role="status">{message}</p>}
    </section>
  );
}
