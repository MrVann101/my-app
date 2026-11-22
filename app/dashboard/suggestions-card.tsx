"use client";

import Link from "next/link";
import { IconChevronRight, IconSparkles } from "@/components/icons";

export default function SuggestionsCard() {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)]/60 p-3.5 transition-colors hover:border-[var(--leaf)]/50">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--leaf-light)] text-[var(--leaf-ink)]">
            <IconSparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xs font-bold text-[var(--foreground)]">Need a meal idea?</h2>
            <p className="truncate text-[11px] text-[var(--ink-muted)]">Matched to remaining kcal</p>
          </div>
        </div>

        <Link
          href="/suggestions"
          className="active-press inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--leaf-ink)] transition-colors hover:border-[var(--leaf)]"
        >
          <span>Explore</span>
          <IconChevronRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
