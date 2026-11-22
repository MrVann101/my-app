import AppShell from "@/components/app-shell";
import DashboardContent from "./dashboard-content";

export default function DashboardPage() {
  return (
    <AppShell eyebrow="Today" title="Daily Overview">
      <DashboardContent />
    </AppShell>
  );
}
