"use client";

import { FormEvent, useState } from "react";
import { IconCheck, IconEye, IconEyeOff } from "@/components/icons";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const newLengthMet = newPassword.length >= 8;
  const confirmTyped = confirmPassword.length > 0;
  const passwordsMatch = confirmTyped && newPassword === confirmPassword;
  const isSameAsCurrent =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    currentPassword === newPassword;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }
    if (!newLengthMet) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (isSameAsCurrent) {
      setError("Choose a new password that is different from your current password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to update your password.");
        setBusy(false);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch {
      setError("Unable to reach Bitewise. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <p className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--ink-muted)]">
        Because Bitewise uses privacy-first username login without requiring an
        email address, password reset links cannot be emailed. Save your
        password in your browser&apos;s password manager so you never lose
        access.
      </p>

      <div>
        <label
          className="block text-sm font-semibold text-[var(--foreground)]"
          htmlFor="acc-current-password"
        >
          Current password
        </label>
        <div className="relative mt-1.5">
          <input
            id="acc-current-password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              if (error) setError(null);
              if (success) setSuccess(false);
            }}
            placeholder="Enter current password"
            className="h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] pl-4 pr-12 text-sm outline-none transition-colors focus:border-[var(--leaf)]"
            type={showCurrent ? "text" : "password"}
            maxLength={72}
            required
          />
          <button
            type="button"
            aria-label={showCurrent ? "Hide current password" : "Show current password"}
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          >
            {showCurrent ? <IconEyeOff className="size-4.5" /> : <IconEye className="size-4.5" />}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              className="text-sm font-semibold text-[var(--foreground)]"
              htmlFor="acc-new-password"
            >
              New password
            </label>
            {newPassword.length > 0 && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  newLengthMet && !isSameAsCurrent
                    ? "text-[var(--leaf)]"
                    : "text-[var(--coral)]"
                }`}
              >
                {newLengthMet && !isSameAsCurrent && <IconCheck className="size-3.5" />}
                <span>
                  {isSameAsCurrent
                    ? "Same as current"
                    : newLengthMet
                      ? "8+ chars"
                      : `${newPassword.length}/8 chars`}
                </span>
              </span>
            )}
          </div>
          <div className="relative mt-1.5">
            <input
              id="acc-new-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                if (error) setError(null);
                if (success) setSuccess(false);
              }}
              placeholder="At least 8 characters"
              className="h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] pl-4 pr-12 text-sm outline-none transition-colors focus:border-[var(--leaf)]"
              type={showNew ? "text" : "password"}
              minLength={8}
              maxLength={72}
              required
            />
            <button
              type="button"
              aria-label={showNew ? "Hide new password" : "Show new password"}
              onClick={() => setShowNew((v) => !v)}
              className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            >
              {showNew ? <IconEyeOff className="size-4.5" /> : <IconEye className="size-4.5" />}
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              className="text-sm font-semibold text-[var(--foreground)]"
              htmlFor="acc-confirm-password"
            >
              Confirm new password
            </label>
            {confirmTyped && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  passwordsMatch ? "text-[var(--leaf)]" : "text-[var(--coral)]"
                }`}
              >
                {passwordsMatch && <IconCheck className="size-3.5" />}
                <span>{passwordsMatch ? "Matches" : "Does not match"}</span>
              </span>
            )}
          </div>
          <div className="relative mt-1.5">
            <input
              id="acc-confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (error) setError(null);
                if (success) setSuccess(false);
              }}
              placeholder="Re-enter new password"
              className={`h-12 w-full rounded-xl border bg-[var(--background)] pl-4 pr-12 text-sm outline-none transition-colors ${
                confirmTyped && !passwordsMatch
                  ? "border-[var(--coral)] focus:border-[var(--coral)]"
                  : passwordsMatch
                    ? "border-[var(--leaf)] focus:border-[var(--leaf)]"
                    : "border-[var(--border-control)] focus:border-[var(--leaf)]"
              }`}
              type={showConfirm ? "text" : "password"}
              minLength={8}
              maxLength={72}
              aria-invalid={confirmTyped && !passwordsMatch ? true : undefined}
              required
            />
            <button
              type="button"
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            >
              {showConfirm ? <IconEyeOff className="size-4.5" /> : <IconEye className="size-4.5" />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p
          className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-xs font-semibold text-[var(--coral)]"
          role="alert"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          className="inline-flex w-full items-center gap-2 rounded-xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] px-4 py-3 text-xs font-bold text-[var(--leaf-ink)]"
          role="status"
        >
          <IconCheck className="size-4 shrink-0 text-[var(--leaf)]" />
          <span>Your password has been updated.</span>
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={busy}
          className="active-press inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--leaf)] px-5 text-xs font-bold text-[var(--on-leaf)] shadow-2xs hover:bg-[var(--leaf-deep)] disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? "Updating password..." : "Update password"}
        </button>
      </div>
    </form>
  );
}
