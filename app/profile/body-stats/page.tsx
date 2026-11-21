import AppShell from "@/components/app-shell";
import BackLink from "@/components/back-link";
import ProfileTools from "../profile-tools";

export default function BodyStatsPage() {
  return (
    <AppShell eyebrow="Settings" title="Body Stats & Calorie Targets">
      <div className="space-y-6">
        <BackLink />

        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-7">
          <h2 className="mb-5 border-b border-[var(--line)] pb-3 text-base font-bold text-[var(--foreground)]">
            Body Stats &amp; Target Calorie Recalculator
          </h2>
          <ProfileTools />
        </div>
      </div>
    </AppShell>
  );
}
