import Link from "next/link";
import { IconBitewiseLogo } from "@/components/icons";
import SignupForm from "./signup-form";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-md">
        <Link className="inline-flex min-h-11 items-center gap-3 text-lg font-semibold tracking-tight" href="/">
          <IconBitewiseLogo className="size-10 shadow-xs" />
          bitewise
        </Link>
        <div className="mt-14 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          <p className="text-sm font-medium text-[var(--leaf)]">Start with clarity</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">We&apos;ll send a verification code to confirm your email before onboarding.</p>
          <SignupForm />
        </div>
      </div>
    </main>
  );
}
