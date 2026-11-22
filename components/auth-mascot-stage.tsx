"use client";

import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { IconSparkles } from "./icons";

export type MascotMood = "idle" | "encouraging" | "celebrating" | "attentive";
export type MascotStageVariant = "login" | "signup" | "onboarding";

const AuthMascotSetterContext = createContext<(mood: MascotMood) => void>(() => {});
const AuthMascotStateContext = createContext<MascotMood>("idle");

export function AuthStageProvider({ children }: { children: ReactNode }) {
  const [mood, setMood] = useState<MascotMood>("idle");
  return (
    <AuthMascotSetterContext.Provider value={setMood}>
      <AuthMascotStateContext.Provider value={mood}>
        {children}
      </AuthMascotStateContext.Provider>
    </AuthMascotSetterContext.Provider>
  );
}

export function useSetAuthMascotMood() {
  return useContext(AuthMascotSetterContext);
}

export function AmbientAuthWash() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-24 top-1/4 size-[28rem] rounded-full bg-[radial-gradient(circle,var(--leaf-light)_0%,transparent_70%)] opacity-70 dark:opacity-30" />
      <div className="absolute -right-24 bottom-12 size-[24rem] rounded-full bg-[radial-gradient(circle,var(--sky-soft)_0%,transparent_70%)] opacity-55 dark:opacity-20" />
    </div>
  );
}

export function AuthCardMotion({ children }: { children: ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        shouldReduceMotion
          ? { duration: 0.14 }
          : { type: "spring", stiffness: 320, damping: 28, mass: 0.85 }
      }
      className="relative z-10 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)]/92 p-6 shadow-[0_20px_48px_-20px_rgba(20,77,51,0.14)] ring-1 ring-inset ring-white/40 backdrop-blur-xl sm:p-8 dark:ring-white/5"
    >
      {children}
    </motion.div>
  );
}

const MOOD_ANIMATE: Record<MascotMood, { y: number; scale: number; rotate: number }> = {
  idle: { y: 0, scale: 1, rotate: 0 },
  encouraging: { y: -4, scale: 1.03, rotate: 2 },
  celebrating: { y: -8, scale: 1.05, rotate: 3 },
  attentive: { y: 2, scale: 0.985, rotate: -2.5 },
};

const VARIANT_LINES: Record<MascotStageVariant, readonly string[]> = {
  login: [
    "Welcome back! Ready to log today's meals?",
    "Small daily habits add up fast.",
    "Your macros and meal plans are waiting!",
    "Consistency beats perfection every day.",
    "Tap anytime for a quick boost!",
  ],
  signup: [
    "Hey! Pick any username, no email needed.",
    "Takes 30 seconds to set up your targets!",
    "Built for everyday meals you actually enjoy.",
    "Let's personalize your daily nutrition plan!",
    "Glad you're here! Ready when you are.",
  ],
  onboarding: [
    "Almost done! These stats shape your daily plan.",
    "Choose the activity level that fits most weeks.",
    "You can update these targets anytime in Settings.",
    "Smart macros, tailored around your goal!",
    "One step left to unlock your dashboard!",
  ],
};

const CLICK_IMPULSES: ReadonlyArray<{
  y: number[];
  scale: number[];
  rotate: number[];
}> = [
  { y: [0, -10, 0], scale: [1, 1.045, 1], rotate: [0, -2.5, 0] },
  { y: [0, -8, 0], scale: [1, 1.05, 1], rotate: [0, 4, -2, 0] },
  { y: [0, -9, 1, -5, 0], scale: [1, 1.04, 0.98, 1.02, 1], rotate: [0, -3, 2, 0] },
  { y: [0, -11, 0], scale: [1, 1.05, 1], rotate: [0, -4.5, 1.5, 0] },
  { y: [0, -12, 0], scale: [1, 1.06, 1], rotate: [0, 3.5, -2.5, 0] },
];

const BURST_PARTICLES: ReadonlyArray<{
  dx: number;
  dy: number;
  rotate: number;
  kind: "leaf" | "sparkle";
  tone: "leaf" | "sky";
}> = [
  { dx: -56, dy: -46, rotate: -28, kind: "sparkle", tone: "leaf" },
  { dx: 58, dy: -44, rotate: 24, kind: "leaf", tone: "leaf" },
  { dx: -66, dy: 4, rotate: -42, kind: "leaf", tone: "sky" },
  { dx: 68, dy: 8, rotate: 38, kind: "sparkle", tone: "sky" },
  { dx: -36, dy: -66, rotate: -16, kind: "leaf", tone: "leaf" },
  { dx: 38, dy: -64, rotate: 20, kind: "sparkle", tone: "leaf" },
];

function MascotLeafParticle({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M13.8 2.2C9.4 2 5.2 4.1 3.3 7.8c-1.2 2.3-1 4.6-.5 5.9 1.3.5 3.6.7 5.9-.5 3.7-1.9 5.8-6.1 5.1-11Z" />
    </svg>
  );
}

export function InteractiveMascot({
  variant = "login",
}: {
  variant?: MascotStageVariant;
}) {
  const mood = useContext(AuthMascotStateContext);
  const shouldReduceMotion = useReducedMotion();

  const [clickCount, setClickCount] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [reactSrc, setReactSrc] = useState("/mascot-react.gif");

  const reactBytesRef = useRef<ArrayBuffer | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const reactTimerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rawRotate = useMotionValue(0);

  const parallaxX = useSpring(rawX, { stiffness: 120, damping: 22, mass: 0.6 });
  const parallaxY = useSpring(rawY, { stiffness: 120, damping: 22, mass: 0.6 });
  const parallaxRotate = useSpring(rawRotate, { stiffness: 120, damping: 24, mass: 0.6 });

  useEffect(() => {
    if (shouldReduceMotion) return;
    let cancelled = false;

    fetch("/mascot-react.gif", { cache: "force-cache" })
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((buf) => {
        if (!cancelled && buf) {
          reactBytesRef.current = buf;
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [shouldReduceMotion]);

  useEffect(() => {
    return () => {
      if (reactTimerRef.current !== null) window.clearTimeout(reactTimerRef.current);
      if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (shouldReduceMotion) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!mq.matches) return;

    const handlePointerMove = (event: PointerEvent) => {
      const nx = (event.clientX / window.innerWidth - 0.5) * 2;
      const ny = (event.clientY / window.innerHeight - 0.5) * 2;
      rawX.set(nx * 7);
      rawY.set(ny * 5);
      rawRotate.set(nx * 1.4);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [shouldReduceMotion, rawX, rawY, rawRotate]);

  const lines = VARIANT_LINES[variant];

  const handleMascotClick = useCallback(() => {
    const nextClick = clickCount + 1;
    setClickCount(nextClick);
    setHasInteracted(true);
    setLineIndex((nextClick - 1) % lines.length);
    setShowBubble(true);

    if (!shouldReduceMotion) {
      if (reactBytesRef.current) {
        const prevBlob = blobUrlRef.current;
        const freshBlobUrl = URL.createObjectURL(
          new Blob([reactBytesRef.current], { type: "image/gif" }),
        );
        blobUrlRef.current = freshBlobUrl;
        setReactSrc(freshBlobUrl);
        if (prevBlob) {
          window.setTimeout(() => URL.revokeObjectURL(prevBlob), 220);
        }
      }
      setIsReacting(true);

      if (reactTimerRef.current !== null) window.clearTimeout(reactTimerRef.current);
      reactTimerRef.current = window.setTimeout(() => {
        setIsReacting(false);
      }, 1420);
    }

    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = window.setTimeout(() => {
      setShowBubble(false);
    }, 3400);
  }, [clickCount, lines.length, shouldReduceMotion]);

  const showReactionGif = !shouldReduceMotion && (isReacting || mood === "celebrating");
  const moodTarget = shouldReduceMotion ? MOOD_ANIMATE.idle : MOOD_ANIMATE[mood];
  const activeImpulse =
    clickCount > 0 && !shouldReduceMotion
      ? CLICK_IMPULSES[(clickCount - 1) % CLICK_IMPULSES.length]
      : null;

  // Onboarding card is wider (max-w-2xl = 672px), so side flanking activates at xl (1280px+)
  // while Login/Signup (max-w-md = 448px) activates side flanking at lg (1024px+).
  const isOnboarding = variant === "onboarding";

  const outerAnchorClass = isOnboarding
    ? "pointer-events-none absolute -top-[5.5rem] right-3 z-20 select-none sm:-top-[6.25rem] sm:right-5 xl:top-0 xl:bottom-0 xl:right-[calc(100%+1.5rem)] 2xl:right-[calc(100%+2.5rem)]"
    : "pointer-events-none absolute -top-[5.5rem] right-3 z-20 select-none sm:-top-[6.25rem] sm:right-5 lg:top-1/2 lg:right-[calc(100%+1.25rem)] lg:-translate-y-1/2 xl:right-[calc(100%+2.25rem)]";

  const stickyHolderClass = isOnboarding ? "xl:sticky xl:top-28" : "";

  const mascotSizeClass = isOnboarding
    ? "relative w-[6.75rem] sm:w-[7.75rem] xl:w-[14.5rem] 2xl:w-[16.5rem]"
    : "relative w-[6.75rem] sm:w-[7.75rem] lg:w-[14.5rem] xl:w-[17rem]";

  const desktopRingVisibility = isOnboarding ? "hidden xl:block" : "hidden lg:block";
  const perchOnlyVisibility = isOnboarding ? "xl:hidden" : "lg:hidden";
  const sideOnlyVisibility = isOnboarding ? "hidden xl:flex" : "hidden lg:flex";

  return (
    <div className={outerAnchorClass}>
      <div className={stickyHolderClass}>
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={
            shouldReduceMotion
              ? { duration: 0.16 }
              : { type: "spring", stiffness: 260, damping: 22, mass: 0.85 }
          }
          style={
            shouldReduceMotion
              ? undefined
              : { x: parallaxX, y: parallaxY, rotate: parallaxRotate }
          }
          className={mascotSizeClass}
        >
          {/* Soft Botanical Aura & Rings */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-3 rounded-full bg-[radial-gradient(circle,var(--leaf-light)_0%,transparent_70%)] opacity-85 lg:-inset-6 dark:opacity-40"
          />
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-2 rounded-full border border-[var(--leaf)]/14 ${desktopRingVisibility}`}
          />
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-7 rounded-full border border-dashed border-[var(--leaf)]/20 ${desktopRingVisibility}`}
          />

          {/*DESKTOP SIDE-STAGE SPEECH BUBBLE (pops cleanly above leaves) */}
          <div
            className={`pointer-events-none absolute bottom-[calc(100%+0.25rem)] left-1/2 z-30 w-max max-w-[14.25rem] -translate-x-1/2 justify-center ${sideOnlyVisibility}`}
          >
            <AnimatePresence mode="wait">
              {showBubble && (
                <motion.div
                  key={`side-${clickCount}`}
                  role="status"
                  aria-live="polite"
                  initial={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: 8, scale: 0.9 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: 4, scale: 0.95 }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.12 }
                      : { type: "spring", stiffness: 440, damping: 24, mass: 0.7 }
                  }
                  style={{ transformOrigin: "50% 100%" }}
                  className="relative rounded-2xl border border-[var(--leaf)]/30 bg-[var(--surface)]/96 px-3.5 py-2 text-center text-xs font-bold leading-snug text-[var(--foreground)] shadow-[0_12px_28px_-10px_rgba(20,77,51,0.22)] backdrop-blur-md"
                >
                  <span>{lines[lineIndex]}</span>
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 border-r border-b border-[var(--leaf)]/30 bg-[var(--surface)]"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* MOBILE/TABLET CARD-PERCH INVITE & SPEECH BUBBLE (pops cleanly to the left of mascot above card) */}
          <div
            className={`pointer-events-none absolute top-3 right-[calc(100%+0.4rem)] z-30 flex items-center justify-end ${perchOnlyVisibility}`}
          >
            <AnimatePresence>
              {showBubble && (
                <motion.div
                  key={`perch-msg-${clickCount}`}
                  role="status"
                  aria-live="polite"
                  initial={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, x: 8, scale: 0.92 }
                  }
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    x: 4,
                    scale: 0.95,
                    transition: { duration: 0.14 },
                  }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.12 }
                      : { type: "spring", stiffness: 440, damping: 24, mass: 0.7 }
                  }
                  style={{ transformOrigin: "100% 50%" }}
                  className="relative w-max max-w-[min(13.5rem,calc(100vw-9.25rem))] rounded-2xl border border-[var(--leaf)]/40 bg-[var(--surface)] px-3.5 py-2 text-left text-xs font-bold leading-snug text-[var(--foreground)] shadow-[0_12px_28px_-8px_rgba(20,77,51,0.24)]"
                >
                  <span>{lines[lineIndex]}</span>
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 -right-1.5 size-2.5 -translate-y-1/2 rotate-45 border-t border-r border-[var(--leaf)]/40 bg-[var(--surface)]"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {!hasInteracted && !showBubble && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={
                  shouldReduceMotion
                    ? { opacity: 1, scale: 1 }
                    : {
                        opacity: 1,
                        scale: [1, 1.04, 1],
                        transition: {
                          opacity: { duration: 0.18 },
                          scale: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
                        },
                      }
                }
                className="relative mt-2 inline-flex items-center gap-1 rounded-full border border-[var(--leaf)]/35 bg-[var(--surface)]/95 px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-[var(--leaf-ink)] shadow-2xs backdrop-blur-md"
              >
                <IconSparkles className="size-3 text-[var(--leaf)]" />
                <span>Tap me!</span>
              </motion.span>
            )}
          </div>

          {/* Radial Botanical & Sparkle Click Burst */}
          <AnimatePresence>
            {clickCount > 0 && !shouldReduceMotion && (
              <div
                key={clickCount}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-30 grid place-items-center"
              >
                {BURST_PARTICLES.map((p, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ x: 0, y: 0, scale: 0.35, opacity: 0.95, rotate: 0 }}
                    animate={{
                      x: p.dx,
                      y: p.dy,
                      scale: [0.4, 1.05, 0.75],
                      opacity: [0.95, 0.9, 0],
                      rotate: p.rotate,
                    }}
                    transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
                    className={
                      p.tone === "leaf"
                        ? "absolute text-[var(--leaf)]"
                        : "absolute text-[var(--sky)]"
                    }
                  >
                    {p.kind === "sparkle" ? (
                      <IconSparkles className="size-3.5 lg:size-4.5" />
                    ) : (
                      <MascotLeafParticle className="size-3 lg:size-4" />
                    )}
                  </motion.span>
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Form-Mood Wrapper */}
          <motion.div
            animate={moodTarget}
            transition={{ type: "spring", stiffness: 340, damping: 18, mass: 0.7 }}
          >
            {/* Interactive Clickable Mascot Button */}
            <motion.button
              type="button"
              onClick={handleMascotClick}
              aria-label="Tap Bitewise mascot for a friendly reaction"
              whileHover={
                shouldReduceMotion ? undefined : { scale: 1.045, y: -3 }
              }
              whileTap={
                shouldReduceMotion ? undefined : { scale: 0.93, y: 2, rotate: -2 }
              }
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              className="pointer-events-auto group relative block w-full cursor-pointer touch-manipulation rounded-3xl bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--leaf)]"
            >
              <motion.div
                key={clickCount}
                animate={activeImpulse ?? undefined}
                transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                className="relative aspect-[440/479] w-full"
              >
                {shouldReduceMotion ? (
                  <Image
                    src="/mascot-apple.png"
                    alt="Bitewise apple mascot"
                    width={731}
                    height={760}
                    priority
                    className="h-full w-full object-contain select-none"
                  />
                ) : (
                  <>
                    <Image
                      src="/mascot-idle.gif"
                      alt="Bitewise apple mascot"
                      width={440}
                      height={479}
                      unoptimized
                      priority
                      className={`h-full w-full object-contain transition-opacity duration-75 select-none ${
                        showReactionGif ? "opacity-0" : "opacity-100"
                      }`}
                    />
                    <Image
                      src={reactSrc}
                      alt=""
                      aria-hidden="true"
                      width={440}
                      height={479}
                      unoptimized
                      priority
                      className={`pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-75 select-none ${
                        showReactionGif ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </>
                )}
              </motion.div>
            </motion.button>
          </motion.div>

          {/* Ground Contact Shadow Ellipse (Desktop Side Stage) */}
          <motion.div
            aria-hidden="true"
            animate={
              shouldReduceMotion
                ? undefined
                : showReactionGif
                  ? { scaleX: [1, 0.68, 1], opacity: [0.2, 0.09, 0.2] }
                  : { scaleX: [1, 0.88, 1], opacity: [0.2, 0.14, 0.2] }
            }
            transition={{
              duration: showReactionGif ? 0.9 : 1.6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className={`pointer-events-none mx-auto -mt-2.5 h-3.5 w-32 rounded-full bg-[var(--leaf-ink)] blur-md xl:w-40 dark:bg-black ${desktopRingVisibility}`}
          />

          {/* Desktop First-Time Invite Pill (cleanly below sneakers, never overlapping artwork) */}
          <div className={`mt-2 justify-center ${sideOnlyVisibility}`}>
            <AnimatePresence>
              {!hasInteracted && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1, scale: 1 }
                      : {
                          opacity: 1,
                          scale: [1, 1.05, 1],
                          transition: {
                            opacity: { duration: 0.18 },
                            scale: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
                          },
                        }
                  }
                  exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.14 } }}
                  className="pointer-events-none inline-flex items-center gap-1 rounded-full border border-[var(--leaf)]/35 bg-[var(--surface)]/95 px-2.5 py-0.5 text-[11px] font-bold text-[var(--leaf-ink)] shadow-2xs backdrop-blur-md"
                >
                  <IconSparkles className="size-3 text-[var(--leaf)]" />
                  <span>Tap me!</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
