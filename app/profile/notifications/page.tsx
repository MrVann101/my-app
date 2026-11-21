import AppShell from "@/components/app-shell";
import BackLink from "@/components/back-link";
import NotificationPreferences from "../notification-preferences";

export default function NotificationsPage() {
  return (
    <AppShell eyebrow="Settings" title="Notification Preferences">
      <div className="space-y-6">
        <BackLink />

        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-7">
          <h2 className="mb-5 border-b border-[var(--line)] pb-3 text-base font-bold text-[var(--foreground)]">
            Meal Reminders &amp; Notification Preferences
          </h2>
          <NotificationPreferences />
        </div>
      </div>
    </AppShell>
  );
}
