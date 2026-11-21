import AppShell from "@/components/app-shell";
import BackLink from "@/components/back-link";
import ProgressContent from "./progress-content";
import WeeklySummary from "./weekly-summary";

export default function ProgressPage() {
  return (
    <AppShell eyebrow="Your nutrition" title="Analytics & Progress">
      <div className="space-y-6">
        <BackLink />
        <WeeklySummary />
        <ProgressContent />
      </div>
    </AppShell>
  );
}
