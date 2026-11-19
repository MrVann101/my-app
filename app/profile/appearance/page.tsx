import AppShell from "@/components/app-shell";
import ThemeToggle from "@/components/theme-toggle";
import Link from "next/link";

export default function AppearancePage() {
  return (
    <AppShell eyebrow="Settings" title="Appearance & Theme">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/profile"
            className="active-press inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3.5 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--line)]"
          >
            <span>← Back to Settings</span>
          </Link>
        </div>

        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--line)] pb-6">
            <div>
              <h2 className="text-base font-bold text-[var(--foreground)]">Theme Mode</h2>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Select your preferred interface color mode. Nordic Dark is enabled by default.
              </p>
            </div>
            <ThemeToggle />
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">Active Design System</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <p className="font-bold text-[var(--leaf)]">Nordic Ocean Dark</p>
                <p className="mt-1 text-[var(--ink-muted)]">Deep midnight slate background (`#0b1320`) with ice blue accents (`#38bdf8`).</p>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <p className="font-bold text-[var(--foreground)]">Nordic Frost Light</p>
                <p className="mt-1 text-[var(--ink-muted)]">Clean snow white canvas with subtle cool slate borders and deep navy typography.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
