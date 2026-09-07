import AppShell from "@/components/app-shell";
import HistoryContent from "@/app/history/history-content";
import Link from "next/link";

export default function ProfileHistoryPage() {
  return (
    <AppShell eyebrow="Settings" title="Meal & Log History">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/profile"
            className="active-press inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3.5 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--line)]"
          >
            <span>← Back to Settings</span>
          </Link>
        </div>

        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-7">
          <HistoryContent />
        </div>
      </div>
    </AppShell>
  );
}
