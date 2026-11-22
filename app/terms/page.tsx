import type { Metadata } from "next";
import Link from "next/link";
import LegalPageShell from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms & Conditions | Bitewise",
  description:
    "Terms of use, eligibility, community meal-plan rules, AI quotas, and health disclaimers for Bitewise.",
};

export default function TermsPage() {
  return (
    <LegalPageShell
      activeTab="terms"
      title="Terms & Conditions"
      summary="Rules for using Bitewise, sharing public meal plans, and understanding our nutrition and AI estimates."
    >
      <section className="rounded-2xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)]/55 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--leaf-ink)]">
          Health, Medical &amp; AI Nutrition Disclaimer
        </h2>
        <p className="mt-2 max-w-[66ch] text-sm leading-relaxed text-[var(--foreground)]">
          Bitewise is a general wellness and meal-tracking tool,{" "}
          <strong>
            not a medical device, healthcare provider, or clinical dietitian
            service
          </strong>
          . Daily targets use standard Mifflin-St Jeor equations with minimum
          calorie safety floors (1,200 kcal/day for female profiles and 1,500
          kcal/day for male profiles). AI photo breakdowns, recipe macros, and
          meal suggestions are estimates that vary with ingredients, cooking
          methods, and portion sizes. Always check food labels and allergens
          yourself, and consult a physician or registered dietitian before
          changing your diet if you are pregnant, nursing, under 18, managing a
          medical condition, or recovering from disordered eating.
        </p>
      </section>

      <section className="max-w-[68ch] space-y-2.5">
        <h2 className="text-base font-bold text-[var(--foreground)]">
          1. Eligibility &amp; Account Responsibility
        </h2>
        <p className="text-[var(--ink-muted)]">
          You must be at least 13 years old to create an account and use
          Bitewise. Because Bitewise lets you sign up with only a username and
          password (no email required), you are responsible for keeping your
          password safe, saving it in your password manager if desired, and
          updating it in{" "}
          <Link
            className="font-bold text-[var(--leaf)] hover:underline"
            href="/profile/account"
          >
            Settings &gt; Account &amp; Data
          </Link>
          . Accounts created without an email address cannot receive password
          reset emails.
        </p>
      </section>

      <section className="max-w-[68ch] space-y-2.5">
        <h2 className="text-base font-bold text-[var(--foreground)]">
          2. Public Meal Plans &amp; Uploaded Photos
        </h2>
        <p className="text-[var(--ink-muted)]">
          Your meal plans and recipes are private by default. If you choose to
          publish a meal plan to Public Plans or attach a dish photo (up to 3
          MB), your username, recipe details, and uploaded cover image become
          visible to other Bitewise users, who may copy that plan into their own
          saved plans.
        </p>
        <p className="text-[var(--ink-muted)]">
          You agree only to upload photos and recipe text that you have the
          right to share, and never to upload unlawful, deceptive, abusive,
          explicit, or infringing content. Bitewise may unpublish or remove
          public content that violates these rules.
        </p>
      </section>

      <section className="max-w-[68ch] space-y-2.5">
        <h2 className="text-base font-bold text-[var(--foreground)]">
          3. Fair Use &amp; AI Quotas
        </h2>
        <p className="text-[var(--ink-muted)]">
          To keep AI features responsive and affordable, Bitewise enforces daily
          per-account and platform rate limits (including up to 2 AI food-photo
          scans and 20 AI text analyses per local day). You agree not to
          automate scraping, overload endpoints, or bypass authentication, Row
          Level Security, or usage caps.
        </p>
      </section>

      <section className="max-w-[68ch] space-y-2.5">
        <h2 className="text-base font-bold text-[var(--foreground)]">
          4. Service Availability &amp; Changes
        </h2>
        <p className="text-[var(--ink-muted)]">
          Bitewise is provided on an &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; basis without warranties of uninterrupted uptime or
          exact nutritional accuracy from external databases or AI models. You
          may stop using Bitewise, export your CSV data, or schedule account
          deletion at any time from{" "}
          <Link
            className="font-bold text-[var(--leaf)] hover:underline"
            href="/profile/account"
          >
            Settings &gt; Account &amp; Data
          </Link>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
