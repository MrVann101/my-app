import Link from "next/link";
import { IconBitewiseLogo } from "@/components/icons";
import VerifyEmailForm from "./verify-email-form";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = "" } = await searchParams;

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-md">
        <Link className="inline-flex min-h-11 items-center gap-3 text-lg font-semibold tracking-tight" href="/">
          <IconBitewiseLogo className="size-10 shadow-xs" />
          bitewise
        </Link>
        <div className="mt-14 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          <p className="text-sm font-medium text-[var(--leaf)]">One quick check</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Enter the 6-digit code sent to <strong className="font-medium text-[var(--foreground)]">{email || "your email"}</strong>. Check spam if it does not arrive shortly.</p>
          <VerifyEmailForm email={email} />
        </div>
      </div>
    </main>
  );
}
