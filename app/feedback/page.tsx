import type { Metadata } from "next";
import Link from "next/link";
import AuthHeader from "@/components/auth-header";
import { AmbientAuthWash } from "@/components/auth-mascot-stage";
import { IconChevronLeft } from "@/components/icons";
import FeedbackClient from "./feedback-client";

export const metadata: Metadata = {
  title: "Suggest an Idea | Bitewise",
  description: "Share feature requests, experience ratings, and improvements for Bitewise.",
};

export default function FeedbackPage() {
  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-[var(--background)]">
      <AmbientAuthWash />
      <AuthHeader badge="Feedback" maxWidthClass="max-w-3xl" />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6">
          <Link
            href="/login"
            className="active-press inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] shadow-2xs transition-colors hover:border-[var(--leaf)] hover:text-[var(--leaf)]"
          >
            <IconChevronLeft className="size-4" />
            <span>Back to Log in</span>
          </Link>
        </div>

        <FeedbackClient />
      </main>
    </div>
  );
}
