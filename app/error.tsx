"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-5 py-10">
      <section className="w-full rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-[var(--coral)]">Something went wrong</p>
        <h1 className="mt-2 text-2xl font-semibold">Bitewise could not load this view.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Your saved data is unchanged. Try loading the view again or return to your dashboard.</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button className="active-press inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--leaf)] px-5 text-sm font-semibold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)]" onClick={() => reset()} type="button">
            Try again
          </button>
          <Link className="active-press inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]" href="/dashboard">
            Go to Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
