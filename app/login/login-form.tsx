"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email"), password: formData.get("password") }),
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
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-medium" htmlFor="login-email">Email</label>
        <input
          id="login-email"
          autoComplete="email"
          className="mt-2 h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]"
          name="email"
          type="email"
          enterKeyHint="next"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="login-password">Password</label>
        <div className="relative mt-2">
          <input
            id="login-password"
            autoComplete="current-password"
            className="h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-4 pr-20 outline-none focus:border-[var(--leaf)]"
            name="password"
            type={showPassword ? "text" : "password"}
            aria-describedby="login-password-hint"
            enterKeyHint="done"
            required
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-1.5 my-auto inline-flex min-h-11 min-w-11 items-center justify-center px-2.5 text-xs font-semibold text-[var(--leaf)]"
            onClick={() => setShowPassword((visible) => !visible)}
            type="button"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <span id="login-password-hint" className="mt-1 block text-xs font-normal text-[var(--ink-muted)]">
          Use your Bitewise account password. Password managers are supported.
        </span>
      </div>
      {error && <p className="text-sm text-[var(--coral)]" role="alert">{error}</p>}
      <button
        className="active-press h-12 w-full rounded-xl bg-[var(--leaf)] font-semibold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:cursor-wait disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Logging in..." : "Log in"}
      </button>
      <p className="text-center text-sm text-[var(--ink-muted)]">
        New to Bitewise? <Link className="font-semibold text-[var(--leaf)] hover:underline" href="/signup">Create an account</Link>
      </p>
    </form>
  );
}
