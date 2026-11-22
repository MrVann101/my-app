import type { Metadata } from "next";
import Link from "next/link";
import LegalPageShell from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | Bitewise",
  description:
    "How Bitewise handles your account credentials, nutrition logs, AI food scans, browser storage, and data deletion.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      activeTab="privacy"
      title="Privacy Policy"
      summary="How Bitewise collects, stores, processes, and deletes your nutrition and account data."
    >
      <section className="max-w-[68ch] space-y-2.5">
        <h2 className="text-base font-bold text-[var(--foreground)]">
          1. Username-First Accounts
        </h2>
        <p className="text-[var(--ink-muted)]">
          Bitewise lets you register with a username (2 to 30 letters, numbers,
          or underscores) and a password (8 to 72 characters) without requiring
          a personal email address. Behind the scenes, new username accounts use
          an internal non-routable identifier for authentication, and passwords
          are hashed by Supabase Auth rather than stored in plain text.
        </p>
      </section>

      <section className="max-w-[68ch] space-y-2.5">
        <h2 className="text-base font-bold text-[var(--foreground)]">
          2. Information We Store
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-[var(--ink-muted)]">
          <li>
            <strong className="font-semibold text-[var(--foreground)]">
              Profile &amp; Body Metrics:
            </strong>{" "}
            Weight, height, age (13 to 120), biological sex, weekly activity
            level, primary nutrition goal, and IANA timezone used to calculate
            your daily calorie and macro targets.
          </li>
          <li>
            <strong className="font-semibold text-[var(--foreground)]">
              Nutrition &amp; Progress Logs:
            </strong>{" "}
            Logged meals, custom foods, daily macro summaries, weight check-ins,
            exercise entries, streaks, badges, saved meal plans, and 7-day
            weekly schedules.
          </li>
          <li>
            <strong className="font-semibold text-[var(--foreground)]">
              Uploaded Photos:
            </strong>{" "}
            Optional meal-plan cover photos (JPEG, PNG, or WebP up to 3 MB) are
            stored in Supabase Storage so your saved or public plans display a
            dish photo. Meal photos submitted to the AI photo scanner (up to 10
            MB) are analyzed in memory to generate editable macro estimates
            before you choose whether to log them.
          </li>
        </ul>
      </section>

      <section className="max-w-[68ch] space-y-2.5">
        <h2 className="text-base font-bold text-[var(--foreground)]">
          3. AI &amp; Third-Party Services
        </h2>
        <p className="text-[var(--ink-muted)]">
          Bitewise connects to specific infrastructure and nutrition services to
          deliver app features. We do not sell your personal or health data to
          advertisers or data brokers.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-[var(--ink-muted)]">
          <li>
            <strong className="font-semibold text-[var(--foreground)]">
              Google Gemini &amp; Groq (AI Features):
            </strong>{" "}
            When you scan a meal photo, parse meal text, generate a recipe,
            build a weekly schedule, or request remaining-macro meal ideas, the
            submitted image or food prompt is sent to Google Gemini (primary) or
            Groq (automatic fallback) to return structured nutrition estimates.
          </li>
          <li>
            <strong className="font-semibold text-[var(--foreground)]">
              USDA FoodData Central &amp; Open Food Facts:
            </strong>{" "}
            Food search queries are sent to USDA FoodData Central and Open Food
            Facts without your username or profile details.
          </li>
          <li>
            <strong className="font-semibold text-[var(--foreground)]">
              Supabase &amp; Vercel:
            </strong>{" "}
            Supabase hosts authentication, Row-Level Security (RLS) Postgres
            tables, and image buckets. Vercel hosts the web application and runs
            scheduled cleanup jobs.
          </li>
        </ul>
      </section>

      <section className="max-w-[68ch] space-y-2.5">
        <h2 className="text-base font-bold text-[var(--foreground)]">
          4. Cookies &amp; Browser Storage
        </h2>
        <p className="text-[var(--ink-muted)]">
          Bitewise uses strictly essential authentication cookies (
          <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-xs text-[var(--foreground)]">
            sb-*-auth-token
          </code>
          ) to keep your session signed in. We do not set third-party
          advertising or cross-site tracking cookies.
        </p>
        <p className="text-[var(--ink-muted)]">
          On your device,{" "}
          <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-xs text-[var(--foreground)]">
            localStorage
          </code>{" "}
          and an offline service-worker shell cache store your light/dark theme
          preference, optional compressed profile avatar (cleared when you log
          out), notification read state, and weekly grocery checklist ticks.
        </p>
      </section>

      <section className="max-w-[68ch] space-y-2.5">
        <h2 className="text-base font-bold text-[var(--foreground)]">
          5. Data Retention &amp; Automatic Cleanup
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-[var(--ink-muted)]">
          <li>
            <strong className="font-semibold text-[var(--foreground)]">
              30-Day Itemized Log Rollup:
            </strong>{" "}
            Each night, Bitewise rolls your daily calorie and macro totals into
            aggregated daily summaries and automatically deletes itemized food
            log entries older than 30 days in your local timezone.
          </li>
          <li>
            <strong className="font-semibold text-[var(--foreground)]">
              30-Day Food Photo Cleanup:
            </strong>{" "}
            Any stored food-log photos are automatically purged after 30 days.
          </li>
          <li>
            <strong className="font-semibold text-[var(--foreground)]">
              Saved Plans &amp; Trends:
            </strong>{" "}
            Aggregated daily summaries, weight check-ins, and saved meal or
            weekly plans stay in your account until you delete them or delete
            your account.
          </li>
        </ul>
      </section>

      <section className="max-w-[68ch] space-y-2.5">
        <h2 className="text-base font-bold text-[var(--foreground)]">
          6. Exporting &amp; Deleting Your Data
        </h2>
        <p className="text-[var(--ink-muted)]">
          You can download your logged meals and daily summaries as a CSV file
          at any time from{" "}
          <Link
            className="font-bold text-[var(--leaf)] hover:underline"
            href="/profile/account"
          >
            Settings &gt; Account &amp; Data
          </Link>
          .
        </p>
        <p className="text-[var(--ink-muted)]">
          From the same page, you can schedule permanent account deletion. When
          requested, any public meal plans you shared are hidden immediately and
          a 14-day grace period begins so you can cancel if you change your
          mind. After 14 days, your authentication record and all linked
          profile, log, summary, and meal-plan rows are permanently deleted.
        </p>
      </section>
    </LegalPageShell>
  );
}
