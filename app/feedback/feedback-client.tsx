"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  IconCheck,
  IconMessagePlus,
  IconStar,
} from "@/components/icons";
import {
  FOCUS_AREA_OPTIONS,
  LOGGING_EASE_OPTIONS,
  MOST_WANTED_CHIPS,
  RATING_OPTIONS,
  STATUS_META,
  type FeedbackFocusArea,
  type FeedbackItem,
  type FeedbackLoggingEase,
  type FeedbackStatus,
} from "@/lib/feedback-schemas";

const LOCAL_IDS_KEY = "bitewise_submitted_feedback_ids_v1";

function readStoredFeedbackIds(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string").slice(0, 25)
      : [];
  } catch {
    return [];
  }
}

function saveStoredFeedbackIds(ids: string[]) {
  try {
    localStorage.setItem(LOCAL_IDS_KEY, JSON.stringify(ids.slice(0, 25)));
  } catch {}
}

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.new;
  const toneClass =
    meta.tone === "leaf"
      ? "border-[var(--leaf)]/30 bg-[var(--leaf-light)] text-[var(--leaf-ink)]"
      : meta.tone === "sky"
        ? "border-[var(--sky)]/30 bg-[var(--sky-soft)] text-[var(--foreground)]"
        : meta.tone === "muted"
          ? "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink-muted)]"
          : "border-[var(--border-control)] bg-[var(--surface-muted)] text-[var(--foreground)]";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${toneClass}`}>
      {meta.label}
    </span>
  );
}

export default function FeedbackClient() {
  const shouldReduceMotion = useReducedMotion();

  const [senderName, setSenderName] = useState("");
  const [overallRating, setOverallRating] = useState<number>(5);
  const [focusArea, setFocusArea] = useState<FeedbackFocusArea>("meal_logging");
  const [loggingEase, setLoggingEase] = useState<FeedbackLoggingEase>("very_easy");
  const [mostWanted, setMostWanted] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [history, setHistory] = useState<FeedbackItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDeviceHistory() {
      const ids = readStoredFeedbackIds();
      if (ids.length === 0) {
        if (active) setIsLoadingHistory(false);
        return;
      }

      try {
        const fbRes = await fetch(`/api/feedback?ids=${encodeURIComponent(ids.join(","))}`);
        if (!active) return;

        if (fbRes.ok) {
          const fbPayload = await fbRes.json();
          setHistory(Array.isArray(fbPayload.items) ? fbPayload.items : []);
        }
      } catch {
        // Non-blocking history load
      } finally {
        if (active) setIsLoadingHistory(false);
      }
    }

    void loadDeviceHistory();
    return () => {
      active = false;
    };
  }, []);

  const selectedAreaOption =
    FOCUS_AREA_OPTIONS.find((opt) => opt.value === focusArea) ?? FOCUS_AREA_OPTIONS[0];

  const trimmedMessage = message.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmittedNotice(null);

    if (trimmedMessage.length < 5) {
      setError("Please share at least a short sentence (5+ characters) describing your idea.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: senderName.trim() || null,
          overallRating,
          focusArea,
          loggingEase,
          mostWanted,
          message: trimmedMessage,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to submit your suggestion.");
        return;
      }

      if (payload.item) {
        const created = payload.item as FeedbackItem;
        const existingIds = readStoredFeedbackIds();
        saveStoredFeedbackIds([created.id, ...existingIds.filter((id) => id !== created.id)]);
        setHistory((prev) => [created, ...prev]);
      }
      setMessage("");
      setMostWanted(null);
      setSubmittedNotice("Thanks for sharing! Your suggestion is now in the Bitewise review queue.");
    } catch {
      setError("Unable to reach Bitewise. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/95 p-6 shadow-xs backdrop-blur-xl sm:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
            Suggest an Idea
          </h1>
          <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-[var(--ink-muted)]">
            No login needed. Answer a few quick prompts and tell us what would
            make Bitewise better for your daily nutrition routine.
          </p>
        </div>

        <LayoutGroup id="bitewise-feedback-form">
          <form className="mt-7 space-y-7" onSubmit={handleSubmit}>
            {/* Optional Name / Nickname */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="feedback-sender-name"
                  className="text-sm font-bold text-[var(--foreground)]"
                >
                  Your name or handle
                </label>
                <span className="text-xs text-[var(--ink-muted)]">Optional</span>
              </div>
              <input
                id="feedback-sender-name"
                type="text"
                maxLength={40}
                value={senderName}
                onChange={(event) => setSenderName(event.target.value)}
                placeholder="e.g. Alex (leave blank to send as Guest)"
                className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-4 text-sm outline-none transition-colors focus:border-[var(--leaf)]"
              />
            </div>

            {/* Step 1: Experience Rating */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-bold text-[var(--foreground)]">
                1. How is Bitewise feeling for you overall?
              </legend>
              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {RATING_OPTIONS.map((opt) => {
                  const active = overallRating === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOverallRating(opt.value)}
                      aria-pressed={active}
                      className={`active-press relative flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--leaf)] ${
                        active
                          ? "border-[var(--leaf)] bg-[var(--leaf-light)]/75 text-[var(--leaf-ink)]"
                          : "border-[var(--border-control)] bg-[var(--background)] text-[var(--ink-muted)] hover:border-[var(--leaf)]/50 hover:text-[var(--foreground)]"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <IconStar
                          className={`size-4 ${
                            opt.value <= overallRating
                              ? "fill-[var(--leaf)] text-[var(--leaf)]"
                              : "text-[var(--ink-muted)]"
                          }`}
                        />
                        <span className="tabular-nums text-sm font-extrabold">
                          {opt.value}
                        </span>
                      </div>
                      <span className="line-clamp-1 text-[10px] font-bold sm:text-[11px]">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Step 2: Focus Area */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-bold text-[var(--foreground)]">
                2. Which part of Bitewise should we improve?
              </legend>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {FOCUS_AREA_OPTIONS.map((opt) => {
                  const active = focusArea === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFocusArea(opt.value)}
                      aria-pressed={active}
                      className={`active-press relative flex min-h-14 cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--leaf)] ${
                        active
                          ? "border-[var(--leaf)] bg-[var(--leaf-light)]/55"
                          : "border-[var(--border-control)] bg-[var(--background)] hover:border-[var(--leaf)]/50"
                      }`}
                    >
                      {active && !shouldReduceMotion && (
                        <motion.span
                          layoutId="feedback-focus-ring"
                          aria-hidden="true"
                          transition={{ type: "spring", stiffness: 420, damping: 30 }}
                          className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-[var(--leaf)]"
                        />
                      )}
                      <div>
                        <span className="block text-xs font-bold text-[var(--foreground)] sm:text-sm">
                          {opt.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
                          {opt.hint}
                        </span>
                      </div>
                      {active && (
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--leaf)] text-[var(--on-leaf)]">
                          <IconCheck className="size-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Step 3: Meal Logging Friction */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-bold text-[var(--foreground)]">
                3. How effortless is logging your daily meals right now?
              </legend>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {LOGGING_EASE_OPTIONS.map((opt) => {
                  const active = loggingEase === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLoggingEase(opt.value)}
                      aria-pressed={active}
                      className={`active-press flex min-h-14 cursor-pointer flex-col justify-center rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--leaf)] ${
                        active
                          ? "border-[var(--leaf)] bg-[var(--leaf-light)]/65 text-[var(--leaf-ink)]"
                          : "border-[var(--border-control)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--leaf)]/50"
                      }`}
                    >
                      <span className="text-xs font-bold sm:text-sm">{opt.label}</span>
                      <span className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                        {opt.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Step 4: Quick Priority Chip */}
            <fieldset className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <legend className="text-sm font-bold text-[var(--foreground)]">
                  4. Top wish right now
                </legend>
                <span className="text-xs font-medium text-[var(--ink-muted)]">
                  Optional · tap to select
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {MOST_WANTED_CHIPS.map((chip) => {
                  const active = mostWanted === chip;
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setMostWanted(active ? null : chip)}
                      aria-pressed={active}
                      className={`active-press inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--leaf)] ${
                        active
                          ? "border-[var(--leaf)] bg-[var(--leaf)] text-[var(--on-leaf)]"
                          : "border-[var(--border-control)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--leaf)]/60"
                      }`}
                    >
                      {active && <IconCheck className="size-3.5" />}
                      <span>{chip}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Step 5: Open Suggestion Message */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="feedback-message"
                  className="text-sm font-bold text-[var(--foreground)]"
                >
                  5. Your suggestion or details
                </label>
                <span className="tabular-nums text-xs text-[var(--ink-muted)]">
                  {message.length}/1500
                </span>
              </div>
              <textarea
                id="feedback-message"
                rows={4}
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  if (error) setError(null);
                  if (submittedNotice) setSubmittedNotice(null);
                }}
                placeholder={selectedAreaOption.placeholder}
                minLength={5}
                maxLength={1500}
                required
                className="mt-2 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] p-4 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--leaf)]"
              />
            </div>

            <AnimatePresence initial={false}>
              {error && (
                <motion.p
                  key="fb-error"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-xs font-bold text-[var(--coral)]"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}

              {submittedNotice && (
                <motion.div
                  key="fb-success"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 rounded-xl border border-[var(--leaf)]/35 bg-[var(--leaf-light)] px-4 py-3 text-xs font-bold text-[var(--leaf-ink)]"
                  role="status"
                >
                  <IconCheck className="size-4 shrink-0 text-[var(--leaf)]" />
                  <span>{submittedNotice}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="active-press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--leaf)] px-6 text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
              >
                <IconMessagePlus className="size-4.5" />
                <span>{isSubmitting ? "Sending suggestion..." : "Send Suggestion"}</span>
              </button>
            </div>
          </form>
        </LayoutGroup>
      </section>

      {/* Device Submission History & Admin Reply Tracker */}
      {(!isLoadingHistory && history.length > 0) && (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/95 p-6 shadow-xs backdrop-blur-xl sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--foreground)]">
                Ideas Sent from This Browser
              </h2>
              <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                Track whether your suggestions are under review, planned, or shipped.
              </p>
            </div>
            <span className="tabular-nums rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-bold text-[var(--ink-muted)]">
              {history.length} {history.length === 1 ? "idea" : "ideas"}
            </span>
          </div>

          <div className="mt-5 space-y-3.5">
            {history.map((item) => {
              const areaLabel =
                FOCUS_AREA_OPTIONS.find((a) => a.value === item.focusArea)?.label ??
                item.focusArea;
              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--background)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status} />
                      <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--foreground)]">
                        {areaLabel}
                      </span>
                      <span className="tabular-nums inline-flex items-center gap-1 text-xs font-bold text-[var(--leaf-ink)]">
                        <IconStar className="size-3.5 fill-[var(--leaf)] text-[var(--leaf)]" />
                        {item.overallRating}/5
                      </span>
                    </div>
                    <time className="tabular-nums text-xs text-[var(--ink-muted)]">
                      {formatShortDate(item.createdAt)}
                    </time>
                  </div>

                  {item.mostWanted && (
                    <p className="mt-2 text-xs font-semibold text-[var(--leaf-ink)]">
                      Top wish: {item.mostWanted}
                    </p>
                  )}

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
                    {item.message}
                  </p>

                  {item.adminNote && (
                    <div className="mt-3 rounded-xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)]/55 px-3.5 py-2.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--leaf-ink)]">
                        Note from Bitewise
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--foreground)]">
                        {item.adminNote}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
