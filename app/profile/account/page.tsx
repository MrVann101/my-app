import AppShell from "@/components/app-shell";
import BackLink from "@/components/back-link";
import AccountControls from "../account-controls";

export default function AccountPage() {
  return (
    <AppShell eyebrow="Settings" title="Account & Data Privacy">
      <div className="space-y-6">
        <BackLink />

        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-7">
          <h2 className="mb-5 border-b border-[var(--line)] pb-3 text-base font-bold text-[var(--foreground)]">
            Data Export &amp; Account Controls
          </h2>
          <AccountControls />
        </div>
      </div>
    </AppShell>
  );
}
