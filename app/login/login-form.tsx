"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

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

    router.push("/");
    router.refresh();
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <label className="block text-sm font-medium">Email<input className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]" name="email" type="email" required /></label>
      <label className="block text-sm font-medium">Password<input className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]" name="password" type="password" required /></label>
      {error && <p className="text-sm text-[var(--coral)]" role="alert">{error}</p>}
      <button className="h-12 w-full rounded-xl bg-[var(--leaf)] font-semibold text-white hover:bg-[var(--leaf-deep)] disabled:cursor-wait disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? "Logging in..." : "Log in"}</button>
      <p className="text-center text-sm text-[var(--ink-muted)]">New to Bitewise? <Link className="font-semibold text-[var(--leaf)]" href="/signup">Create an account</Link></p>
    </form>
  );
}
