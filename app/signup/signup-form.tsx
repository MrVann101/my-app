"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <label className="block text-sm font-medium">Username<input className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]" name="username" pattern="[A-Za-z0-9_]{2,30}" required /></label>
      <label className="block text-sm font-medium">Email<input className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]" name="email" type="email" required /></label>
      <label className="block text-sm font-medium">Password<input className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]" name="password" type="password" minLength={8} required /></label>
      {error && <p className="text-sm text-[var(--coral)]" role="alert">{error}</p>}
      <button className="h-12 w-full rounded-xl bg-[var(--leaf)] font-semibold text-white hover:bg-[var(--leaf-deep)] disabled:cursor-wait disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? "Creating account..." : "Create account"}</button>
      <p className="text-center text-sm text-[var(--ink-muted)]">Already have an account? <a className="font-semibold text-[var(--leaf)]" href="/login">Log in</a></p>
    </form>
  );
}
