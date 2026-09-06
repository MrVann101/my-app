import AppShell from "@/components/app-shell";

export default function MealPlansPage() {
  return <AppShell eyebrow="Meal plans" title="Plan ahead, lightly"><div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6"><p className="font-semibold">Your plans will live here.</p><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Create reusable meal templates without changing today&apos;s totals. Logging a plan is always a separate action.</p></div></AppShell>;
}
