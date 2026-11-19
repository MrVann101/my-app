"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: formData.get("username"),
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error?.message ?? "Unable to create your account.");
      setIsSubmitting(false);
      return;
    }

    const email = formData.get("email");
    router.push(`/verify-email?email=${encodeURIComponent(String(email))}`);
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <label className="block text-sm font-medium">Username<input autoComplete="username" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]" name="username" pattern="[A-Za-z0-9_]{2,30}" required /><span className="mt-1 block text-xs font-normal text-[var(--ink-muted)]">2–30 letters, numbers, or underscores.</span></label>
      <label className="block text-sm font-medium">Email<input autoComplete="email" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]" name="email" type="email" required /></label>
      <label className="block text-sm font-medium">Password<div className="relative mt-2"><input autoComplete="new-password" className="h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 pr-20 outline-none focus:border-[var(--leaf)]" name="password" type={showPassword ? "text" : "password"} minLength={8} required /><button aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-2 min-w-11 px-2 text-xs font-semibold text-[var(--leaf)]" onClick={() => setShowPassword((visible) => !visible)} type="button">{showPassword ? "Hide" : "Show"}</button></div><span className="mt-1 block text-xs font-normal text-[var(--ink-muted)]">At least 8 characters. Use a unique password.</span></label>
      {error && <p className="text-sm text-[var(--coral)]" role="alert">{error}</p>}
      <button className="h-12 w-full rounded-xl bg-[var(--leaf)] font-semibold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:cursor-wait disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? "Creating account..." : "Create account"}</button>
      <p className="text-center text-sm text-[var(--ink-muted)]">Already have an account? <a className="font-semibold text-[var(--leaf)]" href="/login">Log in</a></p>
    </form>
  );
}
