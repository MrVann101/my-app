import AuthHeader from "@/components/auth-header";
import {
  AmbientAuthWash,
  AuthCardMotion,
  AuthStageProvider,
  InteractiveMascot,
} from "@/components/auth-mascot-stage";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <AuthStageProvider>
      <div className="relative min-h-[100dvh] overflow-x-clip bg-[var(--background)]">
        <AmbientAuthWash />
        <AuthHeader maxWidthClass="max-w-md" />

        <main className="relative flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-4 pt-[5.75rem] pb-10 sm:px-8 sm:pt-[6.5rem] sm:pb-14 lg:py-10">
          <div className="relative mx-auto w-full max-w-md">
            <InteractiveMascot variant="login" />

            <AuthCardMotion>
              <div className="pr-24 sm:pr-28 lg:pr-0">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
                  Welcome back
                </h1>
                <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
                  Log in with your Bitewise username and password.
                </p>
              </div>

              <LoginForm />
            </AuthCardMotion>
          </div>
        </main>
      </div>
    </AuthStageProvider>
  );
}
