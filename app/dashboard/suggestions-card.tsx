"use client";

import Link from "next/link";
import { IconSparkles } from "@/components/icons";

export default function SuggestionsCard() {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--leaf-light)] text-[var(--leaf-ink)]">
            <IconSparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">Need a Meal Idea?</h2>
            <p className="text-xs text-[var(--ink-muted)]">
              Get personalized AI meal suggestions matched to your remaining calories.
            </p>
          </div>
        </div>

        <Link
          href="/suggestions"
          className="active-press inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--leaf)] px-4 py-2.5 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)]"
        >
          <IconSparkles className="size-4" />
          <span>Explore AI Suggestions</span>
        </Link>
      </div>
    </section>
  );
}
