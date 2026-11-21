"use client";

import { useState } from "react";
import Link from "next/link";

export default function AccountDeletionPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  async function cancel() {
    setError(null);
    setMessage(null);
    setIsCancelling(true);
    try {
      const response = await fetch("/api/account/cancel-deletion", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to cancel deletion.");
        return;
      }
      setMessage("Deletion cancelled. Your account is restored.");
    } catch {
      setError("Unable to reach Bitewise. Check your connection and try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-10">
      <div className="mx-auto max-w-md rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-[var(--coral)]">Account scheduled for deletion</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">You have 14 days to change your mind.</h1>
        <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
          Your account and data remain untouched during the grace period. After 14 days, deletion is permanent.
        </p>

        {message ? (
          <div className="mt-8 space-y-4">
            <p className="rounded-xl bg-[var(--leaf-light)] p-4 text-sm font-semibold text-[var(--leaf-ink)]" role="status">
              {message}
            </p>
            <Link
              href="/dashboard"
              className="active-press inline-flex h-12 w-full items-center justify-center rounded-xl bg-[var(--leaf)] font-semibold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)]"
            >
              Return to Dashboard
            </Link>
          </div>
        ) : (
          <button
            className="active-press mt-8 h-12 w-full rounded-xl bg-[var(--leaf)] font-semibold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:opacity-50"
            disabled={isCancelling}
            onClick={() => void cancel()}
            type="button"
          >
            {isCancelling ? "Restoring..." : "Cancel deletion & restore account"}
          </button>
        )}

        <Link className="mt-4 flex min-h-11 items-center justify-center text-sm font-semibold text-[var(--leaf)] hover:underline" href="/profile">
          Back to Profile
        </Link>

        {error && <p className="mt-4 text-sm font-medium text-[var(--coral)]" role="alert">{error}</p>}
      </div>
    </main>
  );
}
