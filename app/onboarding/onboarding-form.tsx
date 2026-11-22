"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useSetAuthMascotMood, type MascotMood } from "@/components/auth-mascot-stage";
import { IconCheck, IconChevronRight, IconScale, IconSparkles, IconZap } from "@/components/icons";
import { calculateTargets } from "@/lib/calculations";
import { getBrowserDate } from "@/lib/date";
import { ACTIVITY_LEVEL_OPTIONS, GOAL_OPTIONS } from "@/lib/onboarding-options";
import type { ActivityLevel, Goal, Sex } from "@/lib/types";

const STRONG_EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

function AnimatedNumber({ value }: { value: number }) {
  const shouldReduceMotion = useReducedMotion();
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 260, damping: 30, mass: 0.6 });
  const formatted = useTransform(spring, (latest) => Math.round(latest).toLocaleString());

  useEffect(() => {
    if (shouldReduceMotion) {
      mv.jump(value);
      spring.jump(value);
    } else {
      mv.set(value);
    }
  }, [value, shouldReduceMotion, mv, spring]);

  return (
    <>
      <span className="sr-only">{value.toLocaleString()}</span>
      <motion.span aria-hidden="true">{formatted}</motion.span>
    </>
  );
}

export default function OnboardingForm() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const setMascotMood = useSetAuthMascotMood();

  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex>("female");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [goal, setGoal] = useState<Goal>("lose");
  const [timezone, setTimezone] = useState("UTC");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const liveEstimate = useMemo(() => {
    const w = Number(weightKg);
    const h = Number(heightCm);
    const a = Number(age);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0 || !Number.isInteger(a) || a < 13) {
      return null;
    }
    try {
      return calculateTargets({
        weightKg: w,
        heightCm: h,
        age: a,
        sex,
        activityLevel,
        goal,
        timezone: timezone || "UTC",
      });
    } catch {
      return null;
    }
  }, [weightKg, heightCm, age, sex, activityLevel, goal, timezone]);

  const hasLiveEstimate = Boolean(liveEstimate);

  const nextMood: MascotMood = isSubmitting
    ? "celebrating"
    : error
      ? "attentive"
      : hasLiveEstimate
        ? "encouraging"
        : "idle";

  useEffect(() => {
    setMascotMood(nextMood);
  }, [nextMood, setMascotMood]);

  const sectionVariants = {
    hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0.12 : 0.24,
        ease: STRONG_EASE_OUT,
      },
    },
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const body = new FormData();
      body.set("weightKg", weightKg);
      body.set("heightCm", heightCm);
      body.set("age", age);
      body.set("sex", sex);
      body.set("activityLevel", activityLevel);
      body.set("goal", goal);
      body.set("timezone", timezone);

      const response = await fetch("/api/profile", { method: "POST", body });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to save your profile.");
        setIsSubmitting(false);
        return;
      }

      const numericWeight = Number(weightKg);
      if (Number.isFinite(numericWeight) && numericWeight > 0) {
        void fetch("/api/weight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logDate: getBrowserDate(), weightKg: Math.round(numericWeight * 10) / 10 }),
        }).catch(() => {});
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to reach Bitewise. Check your connection and try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        shouldReduceMotion
          ? { duration: 0.14 }
          : { type: "spring", stiffness: 300, damping: 28, mass: 0.9 }
      }
      className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)]/95 p-5 shadow-[0_20px_48px_-20px_rgba(20,77,51,0.12)] backdrop-blur-xl sm:p-8"
    >
      <div className="pr-24 sm:pr-28 xl:pr-0">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
          Set your daily targets
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]">
          Enter your stats, weekly activity, and goal to calculate your starting calories and macros. You can update these anytime in Settings.
        </p>
      </div>

      <LayoutGroup id="bitewise-onboarding">
        <motion.form
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: shouldReduceMotion ? 0 : 0.05,
              },
            },
          }}
          className="mt-7 space-y-7"
          onSubmit={handleSubmit}
        >
          {/* Section 1: Body Metrics */}
          <motion.fieldset variants={sectionVariants} className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="grid size-7 place-items-center rounded-lg bg-[var(--leaf-light)] text-[var(--leaf)]">
                <IconScale className="size-4" />
              </div>
              <legend className="text-sm font-bold text-[var(--foreground)]">1. Body Metrics</legend>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]" htmlFor="onboard-weightKg">
                  Weight
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="onboard-weightKg"
                    className="tabular-nums h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] pl-4 pr-11 text-sm font-semibold outline-none transition-colors focus:border-[var(--leaf)]"
                    name="weightKg"
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    min="1"
                    max="700"
                    step="0.1"
                    value={weightKg}
                    onChange={(event) => setWeightKg(event.target.value)}
                    required
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--ink-muted)]">
                    kg
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]" htmlFor="onboard-heightCm">
                  Height
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="onboard-heightCm"
                    className="tabular-nums h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] pl-4 pr-12 text-sm font-semibold outline-none transition-colors focus:border-[var(--leaf)]"
                    name="heightCm"
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    min="1"
                    max="300"
                    step="1"
                    value={heightCm}
                    onChange={(event) => setHeightCm(event.target.value)}
                    required
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--ink-muted)]">
                    cm
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]" htmlFor="onboard-age">
                  Age
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="onboard-age"
                    className="tabular-nums h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] pl-4 pr-12 text-sm font-semibold outline-none transition-colors focus:border-[var(--leaf)]"
                    name="age"
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    min="13"
                    max="120"
                    step="1"
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    required
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--ink-muted)]">
                    yrs
                  </span>
                </div>
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]" id="onboard-sex-label">
                Sex for metabolic formula
              </span>
              <div role="radiogroup" aria-labelledby="onboard-sex-label" className="mt-1.5 grid grid-cols-2 gap-2.5">
                {(
                  [
                    { value: "female", label: "Female" },
                    { value: "male", label: "Male" },
                  ] as const
                ).map((option) => {
                  const selected = sex === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSex(option.value)}
                      className={`group relative isolate flex min-h-12 items-center justify-between rounded-xl border px-4 text-sm font-bold transition-colors ${
                        selected
                          ? "border-transparent text-[var(--leaf-ink)]"
                          : "border-[var(--border-control)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--leaf)]"
                      }`}
                    >
                      {selected && (
                        <motion.span
                          layoutId={shouldReduceMotion ? undefined : "onboarding-sex-highlight"}
                          transition={{ type: "spring", stiffness: 500, damping: 36, mass: 0.7 }}
                          className="pointer-events-none absolute inset-0 -z-10 rounded-xl border border-[var(--leaf)] bg-[var(--leaf-light)] shadow-2xs"
                        />
                      )}
                      <div className="flex w-full items-center justify-between transition-transform duration-[var(--duration-press)] ease-[var(--ease-out)] group-active:scale-[0.98] motion-reduce:group-active:scale-100">
                        <span>{option.label}</span>
                        <span
                          aria-hidden="true"
                          className={`grid size-5 place-items-center rounded-full border ${
                            selected
                              ? "border-[var(--leaf)] bg-[var(--leaf)]"
                              : "border-[var(--border-control)] bg-[var(--surface)]"
                          }`}
                        >
                          <AnimatePresence initial={false}>
                            {selected && (
                              <motion.span
                                key="sex-check"
                                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.65 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.75 }}
                                transition={{ type: "spring", stiffness: 520, damping: 26 }}
                                className="grid size-full place-items-center rounded-full text-[var(--on-leaf)]"
                              >
                                <IconCheck className="size-3" />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                Used strictly to select the baseline resting metabolic rate equation.
              </p>
            </div>
          </motion.fieldset>

          {/* Section 2: Activity Level with Short Descriptions */}
          <motion.fieldset variants={sectionVariants} className="space-y-3 border-t border-[var(--line)] pt-6">
            <div className="flex items-center gap-2">
              <div className="grid size-7 place-items-center rounded-lg bg-[var(--leaf-light)] text-[var(--leaf)]">
                <IconZap className="size-4" />
              </div>
              <div>
                <legend className="text-sm font-bold text-[var(--foreground)]">2. Weekly Activity Level</legend>
                <p className="text-xs text-[var(--ink-muted)]">Choose the level that best matches an average week.</p>
              </div>
            </div>

            <div role="radiogroup" aria-label="Weekly activity level" className="grid gap-2.5">
              {ACTIVITY_LEVEL_OPTIONS.map((option, index) => {
                const selected = activityLevel === option.value;
                return (
                  <motion.button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.22,
                      delay: shouldReduceMotion ? 0 : 0.06 + index * 0.035,
                      ease: STRONG_EASE_OUT,
                    }}
                    onClick={() => setActivityLevel(option.value)}
                    className={`group relative isolate flex w-full rounded-2xl border p-3.5 text-left transition-colors sm:p-4 ${
                      selected
                        ? "border-transparent"
                        : "border-[var(--line)] bg-[var(--background)] hover:border-[var(--leaf)]/60 hover:bg-[var(--surface-muted)]/50"
                    }`}
                  >
                    {selected && (
                      <motion.span
                        layoutId={shouldReduceMotion ? undefined : "onboarding-activity-highlight"}
                        transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
                        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl border border-[var(--leaf)] bg-[var(--leaf-light)]/60 shadow-2xs"
                      />
                    )}

                    <div className="flex w-full items-start justify-between gap-3 transition-transform duration-[var(--duration-press)] ease-[var(--ease-out)] group-active:scale-[0.985] motion-reduce:group-active:scale-100">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[var(--foreground)]">{option.label}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
                              selected
                                ? "bg-[var(--leaf)] text-[var(--on-leaf)]"
                                : "bg-[var(--surface-muted)] text-[var(--ink-muted)]"
                            }`}
                          >
                            {option.frequency}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">{option.description}</p>
                      </div>

                      <span
                        aria-hidden="true"
                        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                          selected
                            ? "border-[var(--leaf)] bg-[var(--leaf)]"
                            : "border-[var(--border-control)] bg-[var(--surface)]"
                        }`}
                      >
                        <AnimatePresence initial={false}>
                          {selected && (
                            <motion.span
                              key="activity-check"
                              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.65 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.75 }}
                              transition={{ type: "spring", stiffness: 520, damping: 26 }}
                              className="grid size-full place-items-center rounded-full text-[var(--on-leaf)]"
                            >
                              <IconCheck className="size-3" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.fieldset>

          {/* Section 3: Goal */}
          <motion.fieldset variants={sectionVariants} className="space-y-3 border-t border-[var(--line)] pt-6">
            <div className="flex items-center gap-2">
              <div className="grid size-7 place-items-center rounded-lg bg-[var(--leaf-light)] text-[var(--leaf)]">
                <IconSparkles className="size-4" />
              </div>
              <div>
                <legend className="text-sm font-bold text-[var(--foreground)]">3. Primary Goal</legend>
                <p className="text-xs text-[var(--ink-muted)]">Determines your daily calorie adjustment from maintenance.</p>
              </div>
            </div>

            <div role="radiogroup" aria-label="Primary nutrition goal" className="grid gap-2.5 sm:grid-cols-3">
              {GOAL_OPTIONS.map((option, index) => {
                const selected = goal === option.value;
                return (
                  <motion.button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.22,
                      delay: shouldReduceMotion ? 0 : 0.12 + index * 0.045,
                      ease: STRONG_EASE_OUT,
                    }}
                    onClick={() => setGoal(option.value)}
                    className={`group relative isolate flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-colors sm:p-4 ${
                      selected
                        ? "border-transparent"
                        : "border-[var(--line)] bg-[var(--background)] hover:border-[var(--leaf)]/60 hover:bg-[var(--surface-muted)]/50"
                    }`}
                  >
                    {selected && (
                      <motion.span
                        layoutId={shouldReduceMotion ? undefined : "onboarding-goal-highlight"}
                        transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
                        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl border border-[var(--leaf)] bg-[var(--leaf-light)]/60 shadow-2xs"
                      />
                    )}

                    <div className="transition-transform duration-[var(--duration-press)] ease-[var(--ease-out)] group-active:scale-[0.985] motion-reduce:group-active:scale-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[var(--foreground)]">{option.label}</span>
                        <span
                          aria-hidden="true"
                          className={`grid size-5 shrink-0 place-items-center rounded-full border ${
                            selected
                              ? "border-[var(--leaf)] bg-[var(--leaf)]"
                              : "border-[var(--border-control)] bg-[var(--surface)]"
                          }`}
                        >
                          <AnimatePresence initial={false}>
                            {selected && (
                              <motion.span
                                key="goal-check"
                                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.65 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.75 }}
                                transition={{ type: "spring", stiffness: 520, damping: 26 }}
                                className="grid size-full place-items-center rounded-full text-[var(--on-leaf)]"
                              >
                                <IconCheck className="size-3" />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </span>
                      </div>
                      <span
                        className={`tabular-nums mt-1.5 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors ${
                          selected
                            ? "bg-[var(--leaf)] text-[var(--on-leaf)]"
                            : "bg-[var(--surface-muted)] text-[var(--ink-muted)]"
                        }`}
                      >
                        {option.pacing}
                      </span>
                      <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">{option.description}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.fieldset>

          {/* Live Target Preview Strip with Spring Counter */}
          <AnimatePresence initial={false} mode="wait">
            {liveEstimate ? (
              <motion.div
                key="target-ready"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.99 }}
                transition={{ duration: shouldReduceMotion ? 0.12 : 0.22, ease: STRONG_EASE_OUT }}
                className="rounded-2xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)]/55 p-4"
                aria-live="polite"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--leaf-ink)]">
                    Estimated Daily Target
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--leaf-ink)]/80">Timezone: {timezone}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-3">
                  <p className="tabular-nums text-2xl font-extrabold text-[var(--leaf-ink)]">
                    <AnimatedNumber value={liveEstimate.targetCalories} />{" "}
                    <span className="text-xs font-bold">kcal/day</span>
                  </p>
                  <p className="tabular-nums text-xs font-bold text-[var(--leaf-ink)]">
                    Protein <AnimatedNumber value={liveEstimate.targetProteinG} />g · Carbs{" "}
                    <AnimatedNumber value={liveEstimate.targetCarbsG} />g · Fat{" "}
                    <AnimatedNumber value={liveEstimate.targetFatG} />g
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.p
                key="target-empty"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: shouldReduceMotion ? 0.1 : 0.16, ease: STRONG_EASE_OUT }}
                className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-xs text-[var(--ink-muted)]"
              >
                Timezone detected automatically:{" "}
                <strong className="font-semibold text-[var(--foreground)]">{timezone}</strong>. Enter your weight, height, and age above to preview your daily target.
              </motion.p>
            )}
          </AnimatePresence>

          <motion.div
            layout={shouldReduceMotion ? false : "position"}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="space-y-4"
          >
            <AnimatePresence initial={false}>
              {error && (
                <motion.p
                  key="onboard-error"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0.1 : 0.16, ease: STRONG_EASE_OUT }}
                  className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-xs font-bold text-[var(--coral)]"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              className="active-press inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--leaf)] px-6 text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:cursor-wait disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              <span>{isSubmitting ? "Finishing setup..." : "Continue to Dashboard"}</span>
              {!isSubmitting && <IconChevronRight className="size-4" />}
            </button>
          </motion.div>
        </motion.form>
      </LayoutGroup>
    </motion.div>
  );
}
