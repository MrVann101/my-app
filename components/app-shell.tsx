import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/log", label: "Log" },
  { href: "/history", label: "History" },
  { href: "/meal-plans", label: "Meal Plans" },
  { href: "/profile", label: "Profile" },
];

export default function AppShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-64 shrink-0 border-r border-[var(--line)] bg-[var(--surface)] px-7 py-8 md:block">
          <Link className="flex items-center gap-3 text-lg font-semibold tracking-tight" href="/dashboard">
            <span className="grid size-10 place-items-center rounded-2xl bg-[var(--leaf)] text-lg font-bold text-white">B</span>
            bitewise
          </Link>
          <nav className="mt-16 space-y-2 text-sm font-medium" aria-label="Primary navigation">
            {navigation.map((item) => <Link className="block rounded-xl px-4 py-3 text-[var(--ink-muted)] hover:bg-[var(--surface-muted)]" href={item.href} key={item.href}>{item.label}</Link>)}
          </nav>
          <p className="mt-48 text-xs leading-5 text-[var(--ink-muted)]">Nutrition estimates are for tracking, not medical advice.</p>
        </aside>
        <main className="w-full px-5 pb-28 pt-6 sm:px-8 md:px-12 md:pb-12 md:pt-10">
          <header>
            <p className="text-sm font-medium text-[var(--leaf)]">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          </header>
          <div className="mt-8">{children}</div>
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--line)] bg-[var(--surface)]/95 px-3 py-3 backdrop-blur md:hidden" aria-label="Mobile navigation"><div className="mx-auto flex max-w-md justify-between text-center text-[10px] font-medium text-[var(--ink-muted)]">{navigation.map((item) => <Link href={item.href} key={item.href}><span className="block text-lg">{item.label === "Log" ? "+" : item.label === "Dashboard" ? "⌂" : item.label === "Meal Plans" ? "▦" : item.label === "History" ? "≡" : "○"}</span>{item.label}</Link>)}</div></nav>
    </div>
  );
}
