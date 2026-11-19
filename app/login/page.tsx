import Link from "next/link";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-md">
        <Link className="flex items-center gap-3 text-lg font-semibold tracking-tight" href="/">
          <span className="grid size-10 place-items-center rounded-2xl bg-[var(--leaf)] text-lg font-bold text-[var(--on-leaf)]">B</span>
          bitewise
        </Link>
        <div className="mt-16 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_18px_45px_rgba(30,77,54,0.08)] sm:p-8">
          <p className="text-sm font-medium text-[var(--leaf)]">Welcome back</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Log in to Bitewise</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Your daily view is waiting.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
