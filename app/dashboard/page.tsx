import AppShell from "@/components/app-shell";
import DashboardContent from "./dashboard-content";
import Badges from "./badges";

export default function DashboardPage() {
  return <AppShell eyebrow="Today" title="Your day, at a glance"><div className="space-y-5"><DashboardContent /><Badges /></div></AppShell>;
}
