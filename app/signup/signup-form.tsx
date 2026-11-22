"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSetAuthMascotMood, type MascotMood } from "@/components/auth-mascot-stage";
import { IconCheck, IconEye, IconEyeOff } from "@/components/icons";

const USERNAME_REGEX = /^[A-Za-z0-9_]{2,30}$/;

export default function SignupForm() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const setMascotMood = useSetAuthMascotMood();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedUsername = username.trim();
  const usernameValid = USERNAME_REGEX.test(trimmedUsername);
  const usernameHasInvalidChars = trimmedUsername.length > 0 && !/^[A-Za-z0-9_]+$/.test(trimmedUsername);
  const passwordMinMet = password.length >= 8;
  const confirmTyped = confirmPassword.length > 0;
  const passwordsMatch = confirmTyped && password === confirmPassword;

  const nextMood: MascotMood = isSubmitting
    ? "celebrating"
    : error || usernameHasInvalidChars || (confirmTyped && !passwordsMatch)
      ? "attentive"
      : usernameValid && passwordMinMet && passwordsMatch && acceptedTerms
        ? "encouraging"
        : "idle";

  useEffect(() => {
    setMascotMood(nextMood);
  }, [nextMood, setMascotMood]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!usernameValid) {
      setError("Username must be 2 to 30 letters, numbers, or underscores.");
      return;
    }
    if (!passwordMinMet) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptedTerms) {
      setError(
        "Please confirm you are at least 13 and agree to the Terms & Conditions and Privacy Policy.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmedUsername,
          password,
          confirmPassword,
          acceptedTerms,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error?.message ?? "Unable to create your account.");
        setIsSubmitting(false);
        return;
      }

      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("Unable to reach Bitewise. Check your internet connection and try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div>
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-semibold text-[var(--foreground)]" htmlFor="signup-username">
            Username
          </label>
          {trimmedUsername.length > 0 && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                usernameValid ? "text-[var(--leaf)]" : "text-[var(--coral)]"
              }`}
            >
              {usernameValid && <IconCheck className="size-3.5" />}
              <span>
                {usernameHasInvalidChars
                  ? "Letters, numbers, or _ only"
                  : usernameValid
                    ? "Looks good"
                    : "2-30 characters"}
              </span>
            </span>
          )}
        </div>
        <input
          id="signup-username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. alex_fit"
          className={`mt-1.5 h-12 w-full rounded-xl border bg-[var(--background)] px-4 text-sm outline-none transition-colors ${
            usernameHasInvalidChars
              ? "border-[var(--coral)] focus:border-[var(--coral)]"
              : "border-[var(--border-control)] focus:border-[var(--leaf)]"
          }`}
          name="username"
          type="text"
          minLength={2}
          maxLength={30}
          pattern="[A-Za-z0-9_]{2,30}"
          aria-describedby="signup-username-hint"
          aria-invalid={usernameHasInvalidChars ? true : undefined}
          enterKeyHint="next"
          required
        />
        <p id="signup-username-hint" className="mt-1.5 text-xs text-[var(--ink-muted)]">
          2-30 letters, numbers, or underscores.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-semibold text-[var(--foreground)]" htmlFor="signup-password">
            Password
          </label>
          {password.length > 0 && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                passwordMinMet ? "text-[var(--leaf)]" : "text-[var(--ink-muted)]"
              }`}
            >
              {passwordMinMet && <IconCheck className="size-3.5" />}
              <span>{passwordMinMet ? "8+ chars" : `${password.length}/8 chars`}</span>
            </span>
          )}
        </div>
        <div className="relative mt-1.5">
          <input
            id="signup-password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError(null);
            }}
            placeholder="At least 8 characters"
            className="h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] pl-4 pr-12 text-sm outline-none transition-colors focus:border-[var(--leaf)]"
            name="password"
            type={showPassword ? "text" : "password"}
            minLength={8}
            maxLength={72}
            enterKeyHint="next"
            required
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            onClick={() => setShowPassword((visible) => !visible)}
            type="button"
          >
            {showPassword ? <IconEyeOff className="size-4.5" /> : <IconEye className="size-4.5" />}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-semibold text-[var(--foreground)]" htmlFor="signup-confirm-password">
            Confirm password
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
            id="signup-confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Re-enter password"
            className={`h-12 w-full rounded-xl border bg-[var(--background)] pl-4 pr-12 text-sm outline-none transition-colors ${
              confirmTyped && !passwordsMatch
                ? "border-[var(--coral)] focus:border-[var(--coral)]"
                : passwordsMatch
                  ? "border-[var(--leaf)] focus:border-[var(--leaf)]"
                  : "border-[var(--border-control)] focus:border-[var(--leaf)]"
            }`}
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            minLength={8}
            maxLength={72}
            aria-invalid={confirmTyped && !passwordsMatch ? true : undefined}
            enterKeyHint="done"
            required
          />
          <button
            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            onClick={() => setShowConfirmPassword((visible) => !visible)}
            type="button"
          >
            {showConfirmPassword ? <IconEyeOff className="size-4.5" /> : <IconEye className="size-4.5" />}
          </button>
        </div>
      </div>

      {/* Explicit Age & Policy Consent Checkbox */}
      <label
        htmlFor="signup-accept-terms"
        className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors select-none ${
          acceptedTerms
            ? "border-[var(--leaf)]/45 bg-[var(--leaf-light)]/45"
            : "border-[var(--border-control)] bg-[var(--background)] hover:border-[var(--leaf)]/60"
        }`}
      >
        <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
          <input
            id="signup-accept-terms"
            name="acceptedTerms"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => {
              setAcceptedTerms(event.target.checked);
              if (error) setError(null);
            }}
            required
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="grid size-5 place-items-center rounded-md border border-[var(--border-control)] bg-[var(--surface)] text-transparent transition-colors peer-checked:border-[var(--leaf)] peer-checked:bg-[var(--leaf)] peer-checked:text-[var(--on-leaf)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--leaf)]"
          >
            <IconCheck className="size-3.5" />
          </span>
        </span>

        <span className="text-xs leading-relaxed text-[var(--ink-muted)]">
          I am at least 13 years old and agree to Bitewise&apos;s{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="font-bold text-[var(--leaf)] underline-offset-2 hover:underline"
          >
            Terms &amp; Conditions
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="font-bold text-[var(--leaf)] underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            key="signup-error"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.1 : 0.16, ease: [0.23, 1, 0.32, 1] }}
            className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-xs font-semibold text-[var(--coral)]"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="pt-1">
        <button
          className="active-press h-12 w-full rounded-xl bg-[var(--leaf)] text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:cursor-wait disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </div>

      <p className="border-t border-[var(--line)]/70 pt-5 text-center text-sm text-[var(--ink-muted)]">
        Already have an account?{" "}
        <Link className="font-bold text-[var(--leaf)] hover:underline" href="/login">
          Log in
        </Link>
      </p>
    </form>
  );
}
