"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@/components/dialog";

export default function AccountControls() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function confirmDeletion() {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to schedule deletion.");
        setConfirming(false);
        return;
      }
      setConfirming(false);
      router.push("/account-deletion");
    } catch {
      setError("Unable to schedule deletion. Check your connection and try again.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <h3 className="text-sm font-bold text-[var(--foreground)]">Export Nutrition Data</h3>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Download your food logs and summaries as a portable CSV spreadsheet.
        </p>
        <a
          className="active-press mt-3 inline-flex min-h-11 items-center rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--leaf)] hover:border-[var(--leaf)]"
          download
          href="/api/export/csv"
        >
          Download CSV Export
        </a>
      </div>

      <div className="rounded-2xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] p-4">
        <h3 className="text-sm font-bold text-[var(--coral)]">Danger Zone</h3>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Schedule permanent account deletion with a 14-day grace period in case you change your mind.
        </p>
        <button
          className="active-press mt-3 inline-flex min-h-11 items-center rounded-xl border border-[var(--coral)]/40 bg-[var(--surface)] px-4 text-xs font-bold text-[var(--coral)] hover:bg-[var(--coral)] hover:text-[var(--on-coral)] disabled:opacity-50"
          disabled={busy}
          onClick={() => setConfirming(true)}
          type="button"
        >
          {busy ? "Scheduling..." : "Delete account"}
        </button>
      </div>

      {error && <p className="text-sm font-medium text-[var(--coral)]" role="alert">{error}</p>}

      <Dialog
        open={confirming}
        onClose={() => {
          if (!busy) setConfirming(false);
        }}
        role="alertdialog"
        titleId="delete-account-title"
        descriptionId="delete-account-desc"
        closeOnScrim={!busy}
      >
        <h3 id="delete-account-title" className="text-base font-bold text-[var(--foreground)]">
          Schedule account deletion?
        </h3>
        <p id="delete-account-desc" className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          Your account will be scheduled for permanent deletion after a 14-day grace period. If not cancelled, all food logs, saved meal plans, weekly schedules, weight check-ins, and daily summaries will be permanently erased.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            className="active-press min-h-11 rounded-xl border border-[var(--border-control)] text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
            disabled={busy}
            onClick={() => setConfirming(false)}
            type="button"
          >
            Keep account
          </button>
          <button
            className="active-press min-h-11 rounded-xl bg-[var(--coral)] px-4 text-sm font-bold text-[var(--on-coral)] hover:opacity-90 disabled:opacity-50"
            disabled={busy}
            onClick={() => void confirmDeletion()}
            type="button"
          >
            {busy ? "Scheduling..." : "Schedule deletion"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
