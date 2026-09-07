"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AccountControls() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestDeletion() {
    if (!window.confirm("Schedule this account for permanent deletion after 14 days?")) return;
    setBusy(true);
    const response = await fetch("/api/account/delete", { method: "POST" });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) { setError(payload.error?.message ?? "Unable to schedule deletion."); return; }
    router.push("/account-deletion");
  }

  return <div className="mt-6 border-t border-[var(--line)] pt-5"><a className="text-sm font-semibold text-[var(--leaf)]" download href="/api/export/csv">Download your data</a><div className="mt-4"><button className="text-sm font-semibold text-[var(--coral)] disabled:opacity-50" disabled={busy} onClick={() => void requestDeletion()} type="button">{busy ? "Scheduling..." : "Delete account"}</button></div>{error && <p className="mt-3 text-sm text-[var(--coral)]" role="alert">{error}</p>}</div>;
}
