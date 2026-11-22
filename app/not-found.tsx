import Image from "next/image";
import Link from "next/link";
import AuthHeader from "@/components/auth-header";
import { AmbientAuthWash } from "@/components/auth-mascot-stage";
import { IconChevronRight } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-[var(--background)]">
      <AmbientAuthWash />
      <AuthHeader maxWidthClass="max-w-lg" />

      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg flex-col justify-center px-4 py-10 sm:px-8">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/95 p-6 text-center shadow-xs backdrop-blur-xl sm:p-8">
          <div className="mx-auto w-28 sm:w-32">
            <Image
              src="/mascot-idle.gif"
              alt="Bitewise apple mascot"
              width={440}
              height={479}
              unoptimized
              priority
              className="h-auto w-full object-contain select-none motion-reduce:hidden"
            />
            <Image
              src="/mascot-apple.png"
              alt="Bitewise apple mascot"
              width={731}
              height={760}
              priority
              className="hidden h-auto w-full object-contain select-none motion-reduce:block"
            />
          </div>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
            Page not found
          </h1>
          <p className="mx-auto mt-2 max-w-[44ch] text-sm leading-relaxed text-[var(--ink-muted)]">
            Error 404: that link may have moved or been mistyped. Your logged
            meals, plans, and daily targets are still right where you left them.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Link
              href="/dashboard"
              className="active-press inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--leaf)] px-5 text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] sm:w-auto"
            >
              <span>Go to Dashboard</span>
              <IconChevronRight className="size-4" />
            </Link>
            <Link
              href="/meal-plans"
              className="active-press inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--leaf)] hover:bg-[var(--surface-muted)] sm:w-auto"
            >
              Browse Meal Plans
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
