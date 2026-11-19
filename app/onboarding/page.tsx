import Link from "next/link";
import OnboardingForm from "./onboarding-form";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <Link className="flex items-center gap-3 text-lg font-semibold tracking-tight" href="/">
          <span className="grid size-10 place-items-center rounded-2xl bg-[var(--leaf)] text-lg font-bold text-[var(--on-leaf)]">B</span>
          bitewise
        </Link>
        <div className="mt-12 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_18px_45px_rgba(30,77,54,0.08)] sm:p-8">
          <p className="text-sm font-medium text-[var(--leaf)]">Make it yours</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Set your daily starting point</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">We use these details to estimate a starting calorie and macro target. You can update them later.</p>
          <OnboardingForm />
          <p className="mt-6 border-t border-[var(--line)] pt-5 text-xs leading-5 text-[var(--ink-muted)]">Bitewise provides estimates for tracking and is not medical or professional nutrition advice.</p>
        </div>
      </div>
    </main>
  );
}
