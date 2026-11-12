import AppShell from "@/components/app-shell";
import WeeklyPlanner from "@/app/profile/progress/weekly-planner";

export default function WeeklyPlanPage() {
  return (
    <AppShell eyebrow="Your nutrition" title="Weekly Plan">
      <WeeklyPlanner />
    </AppShell>
  );
}
