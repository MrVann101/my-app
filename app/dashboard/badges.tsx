"use client";

import { useEffect, useState } from "react";
import { IconShieldCheck } from "@/components/icons";

type Badge = { badge_key: string; label: string; earned_at: string };

export default function Badges() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/badges")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Unable to load achievements.");
        if (active) setBadges(payload.badges ?? []);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load achievements.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--foreground)]">Achievements</h2>
          <p className="text-xs text-[var(--ink-muted)]">Milestones unlocked along your journey</p>
        </div>
        <span className="tabular-nums rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-bold text-[var(--ink-muted)]">
          {isLoading ? "…" : `${badges.length} Earned`}
        </span>
      </div>

      {isLoading ? (
        <div className="mt-4 flex gap-2 animate-pulse">
          <div className="h-8 w-28 rounded-full bg-[var(--surface-muted)]" />
          <div className="h-8 w-36 rounded-full bg-[var(--surface-muted)]" />
        </div>
      ) : error ? (
        <p className="mt-4 text-xs font-semibold text-[var(--coral)]" role="alert">{error}</p>
      ) : badges.length === 0 ? (
        <p className="mt-4 text-xs text-[var(--ink-muted)]">
          Your first achievement badge unlocks after logging your first meal.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--leaf)]/25 bg-[var(--leaf-light)] px-3 py-1.5 text-xs font-bold text-[var(--leaf-ink)] shadow-2xs"
              key={badge.badge_key}
              title={badge.earned_at ? `Earned ${badge.earned_at.slice(0, 10)}` : undefined}
            >
              <IconShieldCheck className="size-4" />
              <span>{badge.label}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
