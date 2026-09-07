"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-5 py-10"><section className="w-full rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 text-center"><p className="text-sm font-medium text-[var(--coral)]">Something went wrong</p><h1 className="mt-2 text-2xl font-semibold">Bitewise could not load this view.</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Your saved data is unchanged. Try loading the view again.</p><button className="mt-5 h-11 rounded-xl bg-[var(--leaf)] px-4 text-sm font-semibold text-white" onClick={() => reset()} type="button">Try again</button></section></main>;
}
