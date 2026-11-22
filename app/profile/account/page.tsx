import Link from "next/link";
import AppShell from "@/components/app-shell";
import BackLink from "@/components/back-link";
import { IconChevronRight, IconShieldCheck } from "@/components/icons";
import AccountControls from "../account-controls";
import ChangePasswordForm from "../change-password-form";

export default function AccountPage() {
  return (
    <AppShell eyebrow="Settings" title="Account & Security">
      <div className="space-y-6">
        <BackLink />

        <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-7">
          <div className="mb-5 border-b border-[var(--line)] pb-3">
            <h2 className="text-base font-bold text-[var(--foreground)]">
              Change Password
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              Verify your current password to set a new one.
            </p>
          </div>
          <ChangePasswordForm />
        </section>

        <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-7">
          <div className="mb-5 border-b border-[var(--line)] pb-3">
            <h2 className="text-base font-bold text-[var(--foreground)]">
              Data Export &amp; Account Controls
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              Download your nutrition history or schedule permanent account deletion.
            </p>
          </div>
          <AccountControls />
        </section>

        <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-7">
          <div className="mb-4 border-b border-[var(--line)] pb-3">
            <h2 className="text-base font-bold text-[var(--foreground)]">
              Legal &amp; Health Policies
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              Review how Bitewise protects your data and handles nutrition estimates.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/privacy"
              className="group active-press flex min-h-11 items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3.5 transition-colors hover:border-[var(--leaf)]"
            >
              <div className="flex items-center gap-3">
                <IconShieldCheck className="size-5 shrink-0 text-[var(--leaf)]" />
                <div>
                  <span className="block text-sm font-bold text-[var(--foreground)] group-hover:text-[var(--leaf)]">
                    Privacy Policy
                  </span>
                  <span className="block text-xs text-[var(--ink-muted)]">
                    Data storage, AI scans &amp; retention
                  </span>
                </div>
              </div>
              <IconChevronRight className="size-4 shrink-0 text-[var(--ink-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--leaf)]" />
            </Link>

            <Link
              href="/terms"
              className="group active-press flex min-h-11 items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3.5 transition-colors hover:border-[var(--leaf)]"
            >
              <div className="flex items-center gap-3">
                <IconShieldCheck className="size-5 shrink-0 text-[var(--leaf)]" />
                <div>
                  <span className="block text-sm font-bold text-[var(--foreground)] group-hover:text-[var(--leaf)]">
                    Terms &amp; Disclaimer
                  </span>
                  <span className="block text-xs text-[var(--ink-muted)]">
                    Rules, community plans &amp; medical notice
                  </span>
                </div>
              </div>
              <IconChevronRight className="size-4 shrink-0 text-[var(--ink-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--leaf)]" />
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
