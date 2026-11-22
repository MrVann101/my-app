"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSetAuthMascotMood, type MascotMood } from "@/components/auth-mascot-stage";
import { IconChevronRight, IconEye, IconEyeOff, IconMessagePlus } from "@/components/icons";

export default function LoginForm() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const setMascotMood = useSetAuthMascotMood();

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const nextMood: MascotMood = isSubmitting
    ? "celebrating"
    : error
      ? "attentive"
      : isReady
        ? "encouraging"
        : "idle";

  useEffect(() => {
    setMascotMood(nextMood);
  }, [nextMood, setMascotMood]);

  function handleFormInput(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const usernameInput = form.elements.namedItem("username") as HTMLInputElement | null;
    const passwordInput = form.elements.namedItem("password") as HTMLInputElement | null;
    const ready = Boolean(usernameInput?.value.trim() && passwordInput?.value);
    setIsReady((prev) => (prev === ready ? prev : ready));
    if (error) setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error?.message ?? "Unable to log in.");
        setIsSubmitting(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to reach Bitewise. Check your internet connection and try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-6 space-y-4" onInput={handleFormInput} onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-semibold text-[var(--foreground)]" htmlFor="login-username">
          Username
        </label>
        <input
          id="login-username"
          autoComplete="username"
          placeholder="Enter your username"
          className="mt-1.5 h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-4 text-sm outline-none transition-colors focus:border-[var(--leaf)]"
          name="username"
          type="text"
          enterKeyHint="next"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[var(--foreground)]" htmlFor="login-password">
          Password
        </label>
        <div className="relative mt-1.5">
          <input
            id="login-password"
            autoComplete="current-password"
            placeholder="Enter your password"
            className="h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] pl-4 pr-12 text-sm outline-none transition-colors focus:border-[var(--leaf)]"
            name="password"
            type={showPassword ? "text" : "password"}
            enterKeyHint="done"
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

      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            key="login-error"
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

      <div className="pt-2">
        <button
          className="active-press h-12 w-full rounded-xl bg-[var(--leaf)] text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:cursor-wait disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
      </div>

      <div className="space-y-3 border-t border-[var(--line)]/70 pt-5 text-center">
        <p className="text-sm text-[var(--ink-muted)]">
          New to Bitewise?{" "}
          <Link className="font-bold text-[var(--leaf)] hover:underline" href="/signup">
            Create an account
          </Link>
        </p>

        <Link
          href="/feedback"
          className="active-press inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]/80 px-4 text-xs font-bold text-[var(--foreground)] transition-colors hover:border-[var(--leaf)] hover:text-[var(--leaf)]"
        >
          <IconMessagePlus className="size-4 text-[var(--leaf)]" />
          <span>Feedback · Suggest an Idea</span>
          <IconChevronRight className="size-3.5 text-[var(--ink-muted)]" />
        </Link>

        <p className="text-xs text-[var(--ink-muted)]">
          <Link className="font-medium hover:text-[var(--leaf)] hover:underline" href="/privacy">
            Privacy Policy
          </Link>
          {" · "}
          <Link className="font-medium hover:text-[var(--leaf)] hover:underline" href="/terms">
            Terms &amp; Conditions
          </Link>
        </p>
      </div>
    </form>
  );
}
