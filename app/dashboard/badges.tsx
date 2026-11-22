"use client";

import { useEffect, useState } from "react";
import { IconShieldCheck } from "@/components/icons";

type Badge = { badge_key: string; label: string; earned_at: string };

const DEFAULT_VISIBLE_BADGES = 4;

export default function Badges() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

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

  const hasOverflow = badges.length > DEFAULT_VISIBLE_BADGES;
  const visibleBadges = showAll ? badges : badges.slice(0, DEFAULT_VISIBLE_BADGES);

  return (
    <section className="rounded-2xl border border-[var(--line)]/80 bg-[var(--surface)] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">Achievements</h2>
        <span className="tabular-nums rounded-full bg-[var(--surface-muted)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--ink-muted)]">
          {isLoading ? "…" : `${badges.length} earned`}
        </span>
      </div>

      {isLoading ? (
        <div className="mt-2.5 flex gap-2 animate-pulse">
          <div className="h-7 w-24 rounded-full bg-[var(--surface-muted)]" />
          <div className="h-7 w-28 rounded-full bg-[var(--surface-muted)]" />
        </div>
      ) : error ? (
        <p className="mt-2.5 text-xs font-semibold text-[var(--coral)]" role="alert">{error}</p>
      ) : badges.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--ink-muted)]">
          Unlock your first badge after logging a meal.
        </p>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {visibleBadges.map((badge) => (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-[var(--leaf)]/25 bg-[var(--leaf-light)] px-2.5 py-1 text-[11px] font-semibold text-[var(--leaf-ink)]"
              key={badge.badge_key}
              title={badge.earned_at ? `Earned ${badge.earned_at.slice(0, 10)}` : undefined}
            >
              <IconShieldCheck className="size-3.5 shrink-0" />
              <span>{badge.label}</span>
            </span>
          ))}
          {hasOverflow && (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((open) => !open)}
              className="active-press inline-flex min-h-11 items-center rounded-full border border-[var(--border-control)] px-3 text-[11px] font-bold text-[var(--ink-muted)] hover:border-[var(--leaf)] hover:text-[var(--foreground)]"
            >
              {showAll ? "Show less" : `+${badges.length - DEFAULT_VISIBLE_BADGES} more`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
