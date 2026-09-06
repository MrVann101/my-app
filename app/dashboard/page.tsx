import AppShell from "@/components/app-shell";
import DashboardContent from "./dashboard-content";

export default function DashboardPage() {
  return <AppShell eyebrow="Today" title="Your day, at a glance"><DashboardContent /></AppShell>;
}
