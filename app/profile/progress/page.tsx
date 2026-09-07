import AppShell from "@/components/app-shell";
import ProgressContent from "./progress-content";
import WeeklySummary from "./weekly-summary";
import Link from "next/link";

export default function ProgressPage() {
  return (
    <AppShell eyebrow="Settings" title="Analytics & Progress">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/profile"
            className="active-press inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3.5 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--line)]"
          >
            <span>← Back to Settings</span>
          </Link>
        </div>
        <WeeklySummary />
        <ProgressContent />
      </div>
    </AppShell>
  );
}

