"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyEmailForm({ email }: { email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = window.setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const token = new FormData(event.currentTarget).get("token");
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error?.message ?? "That code could not be verified.");
        setIsSubmitting(false);
        return;
      }

      router.push("/onboarding");
    } catch {
      setError("Unable to reach Bitewise. Check your internet connection and try again.");
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || !email || isResending) return;
    setError(null);
    setMessage(null);
    setIsResending(true);

    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error?.message ?? "Unable to resend the code.");
        return;
      }

      setMessage("A new code is on its way.");
      setCooldown(result.cooldownSeconds ?? 60);
    } catch {
      setError("Unable to reach Bitewise. Check your internet connection and try again.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleVerify}>
      <div>
        <label className="block text-sm font-medium" htmlFor="verify-otp">6-digit code</label>
        <input
          id="verify-otp"
          className="mt-2 h-14 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-4 text-center text-2xl tracking-[0.35em] outline-none focus:border-[var(--leaf)]"
          name="token"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="one-time-code"
          enterKeyHint="done"
          required
        />
      </div>
      {error && <p className="text-sm text-[var(--coral)]" role="alert">{error}</p>}
      {message && <p className="text-sm text-[var(--leaf)]" role="status">{message}</p>}
      <button
        className="active-press h-12 w-full rounded-xl bg-[var(--leaf)] font-semibold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:cursor-wait disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Verifying..." : "Verify email"}
      </button>
      <button
        className="active-press min-h-11 w-full rounded-xl border border-[var(--border-control)] font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={cooldown > 0 || !email || isResending}
        onClick={() => void handleResend()}
        type="button"
      >
        {isResending ? "Sending..." : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </button>
      <p className="text-center text-sm text-[var(--ink-muted)]">
        <Link className="font-semibold text-[var(--leaf)] hover:underline" href="/signup">Use a different email</Link>
      </p>
    </form>
  );
}
