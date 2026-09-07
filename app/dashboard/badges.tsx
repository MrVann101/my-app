"use client";

import { useEffect, useState } from "react";

type Badge = { badge_key: string; label: string; earned_at: string };

export default function Badges() {
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    fetch("/api/badges")
      .then((response) => response.json())
      .then((payload) => setBadges(payload.badges ?? []))
      .catch(() => setBadges([]));
  }, []);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--foreground)]">Achievements</h2>
          <p className="text-xs text-[var(--ink-muted)]">Milestones unlocked along your journey</p>
        </div>
        <span className="tabular-nums rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-bold text-[var(--ink-muted)]">
          {badges.length} Earned
        </span>
      </div>

      {badges.length === 0 ? (
        <p className="mt-4 text-xs text-[var(--ink-muted)]">
          Your first achievement badge unlocks after logging your first meal!
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--leaf)]/20 bg-[var(--leaf-light)] px-3 py-1.5 text-xs font-bold text-[var(--leaf)] shadow-2xs"
              key={badge.badge_key}
            >
              <span>🏆</span>
              <span>{badge.label}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
