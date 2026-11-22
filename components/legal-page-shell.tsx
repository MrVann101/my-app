"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import AuthHeader from "./auth-header";
import { AmbientAuthWash } from "./auth-mascot-stage";
import { IconChevronLeft } from "./icons";

export default function LegalPageShell({
  activeTab,
  title,
  summary,
  lastUpdated = "November 22, 2026",
  children,
}: {
  activeTab: "privacy" | "terms";
  title: string;
  summary: string;
  lastUpdated?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/login");
    }
  }

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-[var(--background)]">
      <AmbientAuthWash />
      <AuthHeader maxWidthClass="max-w-3xl" />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="active-press inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] shadow-2xs transition-colors hover:border-[var(--leaf)] hover:text-[var(--leaf)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--leaf)]"
          >
            <IconChevronLeft className="size-4" />
            <span>Back</span>
          </button>

          <nav
            aria-label="Legal documents"
            className="inline-flex rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-2xs"
          >
            <Link
              href="/privacy"
              aria-current={activeTab === "privacy" ? "page" : undefined}
              className={`inline-flex min-h-9 items-center rounded-lg px-3.5 text-xs font-bold transition-colors ${
                activeTab === "privacy"
                  ? "bg-[var(--leaf)] text-[var(--on-leaf)]"
                  : "text-[var(--ink-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              aria-current={activeTab === "terms" ? "page" : undefined}
              className={`inline-flex min-h-9 items-center rounded-lg px-3.5 text-xs font-bold transition-colors ${
                activeTab === "terms"
                  ? "bg-[var(--leaf)] text-[var(--on-leaf)]"
                  : "text-[var(--ink-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Terms &amp; Conditions
            </Link>
          </nav>
        </div>

        <article className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/95 p-6 shadow-xs backdrop-blur-xl sm:p-10">
          <header className="border-b border-[var(--line)] pb-6">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-[var(--ink-muted)]">
              {summary}
            </p>
            <p className="mt-3 text-xs font-semibold text-[var(--ink-muted)]">
              Last updated: {lastUpdated}
            </p>
          </header>

          <div className="mt-7 space-y-8 text-sm leading-7 text-[var(--foreground)]">
            {children}
          </div>
        </article>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[var(--ink-muted)]">
          <span>Bitewise · Calm Calorie &amp; Nutrition Tracking</span>
          <div className="flex items-center gap-4 font-semibold">
            <Link className="hover:text-[var(--leaf)] hover:underline" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="hover:text-[var(--leaf)] hover:underline" href="/terms">
              Terms &amp; Conditions
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
