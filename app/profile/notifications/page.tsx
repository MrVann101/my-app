import AppShell from "@/components/app-shell";
import NotificationPreferences from "../notification-preferences";
import Link from "next/link";

export default function NotificationsPage() {
  return (
    <AppShell eyebrow="Settings" title="Notification Preferences">
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
          <h2 className="text-base font-bold text-[var(--foreground)] border-b border-[var(--line)] pb-3 mb-5">
            Meal Reminders & Notification Preferences
          </h2>
          <NotificationPreferences />
        </div>
      </div>
    </AppShell>
  );
}
