"use client";

import { useState } from "react";
import Link from "next/link";

export default function AccountDeletionPage() {
  const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [isCancelling, setIsCancelling] = useState(false);
  async function cancel() { setIsCancelling(true); const response = await fetch("/api/account/cancel-deletion", { method: "POST" }); const payload = await response.json(); setIsCancelling(false); if (!response.ok) { setError(payload.error?.message ?? "Unable to cancel deletion."); return; } setMessage("Deletion cancelled. Your account is restored."); }
  return <main className="min-h-screen bg-[var(--background)] px-5 py-8"><div className="mx-auto max-w-md rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8"><p className="text-sm font-medium text-[var(--coral)]">Account scheduled for deletion</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">You have 14 days to change your mind.</h1><p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">Your account and data remain untouched during the grace period. After that, deletion is permanent.</p><button className="mt-8 h-12 w-full rounded-xl bg-[var(--leaf)] font-semibold text-[var(--on-leaf)] disabled:opacity-50" disabled={isCancelling} onClick={cancel} type="button">{isCancelling ? "Restoring..." : "Cancel deletion"}</button><Link className="mt-4 block text-center text-sm font-semibold text-[var(--leaf)]" href="/profile">Back to Profile</Link>{error && <p className="mt-5 text-sm text-[var(--coral)]" role="alert">{error}</p>}{message && <p className="mt-5 text-sm text-[var(--leaf)]" role="status">{message}</p>}</div></main>;
}
