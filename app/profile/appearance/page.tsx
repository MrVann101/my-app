import AppShell from "@/components/app-shell";
import BackLink from "@/components/back-link";
import ThemeToggle from "@/components/theme-toggle";

export default function AppearancePage() {
  return (
    <AppShell eyebrow="Settings" title="Appearance & Theme">
      <div className="space-y-6">
        <BackLink />

        <div className="space-y-6 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-7">
          <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-bold text-[var(--foreground)]">Theme Mode</h2>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Select your preferred interface color mode. Warm Nordic Light is enabled by default.
              </p>
            </div>
            <ThemeToggle />
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">Active Design System</h3>
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <p className="font-bold text-[var(--leaf)]">Warm Nordic Light</p>
                <p className="mt-1 text-[var(--ink-muted)]">
                  Soft oat paper canvas with crisp dark ink and high-contrast botanical macro indicators.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <p className="font-bold text-[var(--foreground)]">Warm Nordic Dark</p>
                <p className="mt-1 text-[var(--ink-muted)]">
                  Deep espresso charcoal surfaces with fresh herb-green accents and warm parchment text.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
