import AuthHeader from "@/components/auth-header";
import {
  AmbientAuthWash,
  AuthCardMotion,
  AuthStageProvider,
  InteractiveMascot,
} from "@/components/auth-mascot-stage";
import SignupForm from "./signup-form";

export default function SignupPage() {
  return (
    <AuthStageProvider>
      <div className="relative min-h-[100dvh] overflow-x-clip bg-[var(--background)]">
        <AmbientAuthWash />
        <AuthHeader badge="Step 1 of 2" maxWidthClass="max-w-md" />

        <main className="relative flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-4 pt-[5.75rem] pb-10 sm:px-8 sm:pt-[6.5rem] sm:pb-14 lg:py-10">
          <div className="relative mx-auto w-full max-w-md">
            <InteractiveMascot variant="signup" />

            <AuthCardMotion>
              <div className="pr-24 sm:pr-28 lg:pr-0">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
                  Create account
                </h1>
                <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
                  Pick a username and password to get started.
                </p>
              </div>

              <SignupForm />
            </AuthCardMotion>
          </div>
        </main>
      </div>
    </AuthStageProvider>
  );
}
