import AuthHeader from "@/components/auth-header";
import {
  AmbientAuthWash,
  AuthStageProvider,
  InteractiveMascot,
} from "@/components/auth-mascot-stage";
import OnboardingForm from "./onboarding-form";

export default function OnboardingPage() {
  return (
    <AuthStageProvider>
      <div className="relative min-h-[100dvh] overflow-x-clip bg-[var(--background)]">
        <AmbientAuthWash />
        <AuthHeader badge="Step 2 of 2" maxWidthClass="max-w-2xl" />

        <main className="relative px-4 pt-[5.75rem] pb-10 sm:px-8 sm:pt-[6.5rem] sm:pb-14 xl:py-10">
          <div className="relative mx-auto w-full max-w-2xl">
            <InteractiveMascot variant="onboarding" />

            <OnboardingForm />
          </div>
        </main>
      </div>
    </AuthStageProvider>
  );
}
