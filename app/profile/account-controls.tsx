"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AccountControls() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function requestDeletion() {
    setConfirming(true);
  }

  async function confirmDeletion() {
    setConfirming(false);
    setBusy(true);
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error?.message ?? "Unable to schedule deletion."); return; }
      router.push("/account-deletion");
    } catch {
      setError("Unable to schedule deletion. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-6 border-t border-[var(--line)] pt-5"><a className="text-sm font-semibold text-[var(--leaf)]" download href="/api/export/csv">Download your data</a><div className="mt-4"><button className="min-h-11 text-sm font-semibold text-[var(--coral)] disabled:opacity-50" disabled={busy} onClick={() => void requestDeletion()} type="button">{busy ? "Scheduling..." : "Delete account"}</button></div>{error && <p className="mt-3 text-sm text-[var(--coral)]" role="alert">{error}</p>}{confirming && <div className="mt-4 rounded-2xl border border-[var(--coral)]/30 bg-[var(--coral)]/10 p-4" role="alertdialog" aria-modal="false" aria-labelledby="delete-account-title"><h3 id="delete-account-title" className="font-semibold text-[var(--foreground)]">Delete your account?</h3><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Your account will be scheduled for permanent deletion after a 14-day grace period. You can cancel during that period.</p><div className="mt-4 flex flex-wrap gap-2"><button className="min-h-11 rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-semibold" onClick={() => setConfirming(false)} type="button">Keep account</button><button className="min-h-11 rounded-xl bg-[var(--coral)] px-4 py-2 text-sm font-semibold text-white" onClick={() => void confirmDeletion()} type="button">Schedule deletion</button></div></div>}</div>;
}
