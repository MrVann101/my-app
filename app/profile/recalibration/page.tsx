import AppShell from "@/components/app-shell";
import BackLink from "@/components/back-link";
import RecalibrationCard from "../recalibration-card";

export default function RecalibrationPage() {
  return (
    <AppShell eyebrow="Settings" title="Adaptive Recalibration">
      <div className="space-y-6">
        <BackLink />
        <RecalibrationCard />
      </div>
    </AppShell>
  );
}
