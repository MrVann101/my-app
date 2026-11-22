"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/app-shell";
import { IconCheck, IconChevronLeft, IconChevronRight, IconLog, IconSparkles } from "@/components/icons";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";
import { defaultMealTypeByHour } from "@/lib/meal-slot";

type Suggestion = {
  title: string;
  description: string;
  estimatedCalories: number;
  proteinG: number;
};

type SuggestionProvider = "gemini" | "groq" | "fallback";

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [provider, setProvider] = useState<SuggestionProvider | null>(null);
  const [remainingCalories, setRemainingCalories] = useState<number | null>(null);
  const [logDate, setLogDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggedStatus, setLoggedStatus] = useState<string | null>(null);
  const [loggingSuggestions, setLoggingSuggestions] = useState<Set<Suggestion>>(() => new Set());
  const [loggedSuggestions, setLoggedSuggestions] = useState<Set<Suggestion>>(() => new Set());
  const generation = useRef(0);

  async function loadSuggestions() {
    setIsLoading(true);
    setError(null);
    try {
      generation.current += 1;
      const params = new URLSearchParams({ generation: String(generation.current), timezone: getBrowserTimezone() });
      suggestions.forEach((suggestion) => params.append("exclude", suggestion.title));
      const response = await fetch(`/api/suggestions?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Suggestions are currently unavailable.");
        return;
      }
      setRemainingCalories(payload.remainingCalories ?? null);
      setLogDate(payload.date ?? null);
      setSuggestions(
        (payload.suggestions ?? []).filter(
          (suggestion: Suggestion) =>
            typeof payload.remainingCalories === "number" && suggestion.estimatedCalories <= payload.remainingCalories,
        ),
      );
      setProvider(payload.providerUsed ?? null);
    } catch {
      setError("Unable to load suggestions. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function fetchSuggestions() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/suggestions?timezone=${encodeURIComponent(getBrowserTimezone())}`);
        const payload = await response.json();

        if (!active) return;

        if (!response.ok) {
          setError(payload.error?.message ?? "Suggestions are currently unavailable.");
          return;
        }

        setRemainingCalories(payload.remainingCalories ?? null);
        setLogDate(payload.date ?? null);
        setSuggestions(
          (payload.suggestions ?? []).filter(
            (suggestion: Suggestion) =>
              typeof payload.remainingCalories === "number" && suggestion.estimatedCalories <= payload.remainingCalories,
          ),
        );
        setProvider(payload.providerUsed ?? null);
      } catch {
        if (!active) return;
        setError("Unable to load suggestions.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void fetchSuggestions();

    return () => {
      active = false;
    };
  }, []);

  async function logSuggestion(suggestion: Suggestion) {
    setError(null);
    setLoggedStatus(null);
    setLoggingSuggestions((current) => new Set(current).add(suggestion));
    try {
      const mealType = defaultMealTypeByHour();
      const response = await fetch("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate: logDate ?? getBrowserDate(),
          timezone: getBrowserTimezone(),
          mealType,
          foodName: suggestion.title,
          weightG: 150,
          nutrientRate: {
            caloriesPerG: suggestion.estimatedCalories / 150,
            proteinPerG: suggestion.proteinG / 150,
            carbsPerG: 0,
            fatPerG: 0,
            fiberPerG: 0,
            sodiumPerG: 0,
            sugarPerG: 0,
          },
          source: "ai_text",
          dataSource: provider === "gemini" || provider === "groq" ? provider : null,
          aiConfidence: "high",
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to log suggestion.");
        return;
      }
      setLoggedSuggestions((current) => new Set(current).add(suggestion));
      setLoggedStatus(`Added "${suggestion.title}" (${Math.round(suggestion.estimatedCalories)} kcal) to ${mealType}.`);
    } catch (logError) {
      setError(logError instanceof Error ? logError.message : "Unable to log suggestion.");
    } finally {
      setLoggingSuggestions((current) => {
        const next = new Set(current);
        next.delete(suggestion);
        return next;
      });
    }
  }

  return (
    <AppShell eyebrow="AI Ideas" title="AI Suggestions">
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:flex-row sm:items-center sm:p-7">
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">Smart Meal Ideas</h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Suggestions sized to fit your remaining calories and macro budget today.
            </p>
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void loadSuggestions()}
            className="hover-lift active-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--leaf)] px-4 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
          >
            <IconSparkles className="size-4" />
            <span>{isLoading ? "Generating..." : "Generate New Ideas"}</span>
          </button>
        </div>

        {loggedStatus && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-4 text-xs font-bold text-[var(--leaf-ink)]" role="status">
            <span className="inline-flex items-center gap-1.5">
              <IconCheck className="size-4 shrink-0" />
              <span>{loggedStatus}</span>
            </span>
            <Link href="/dashboard" className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:opacity-80">
              <span>View Dashboard</span>
              <IconChevronRight className="size-3.5" />
            </Link>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] p-4 text-xs font-bold text-[var(--coral)]" role="alert">
            {error}
          </div>
        )}

        {remainingCalories !== null && !isLoading && !error && (
          <p className="text-sm font-semibold text-[var(--ink-muted)]" aria-live="polite">
            Meals below your remaining budget of {Math.max(0, Math.round(remainingCalories)).toLocaleString()} kcal
          </p>
        )}

        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-32 rounded-2xl bg-[var(--surface-muted)]" />
            <div className="h-32 rounded-2xl bg-[var(--surface-muted)]" />
            <div className="h-32 rounded-2xl bg-[var(--surface-muted)]" />
          </div>
        )}

        {!isLoading && suggestions.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.title}-${index}`}
                className="hover-lift flex flex-col justify-between rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs transition-colors hover:border-[var(--leaf)]/50"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-[var(--foreground)]">{suggestion.title}</h3>
                    <span className="tabular-nums shrink-0 rounded-full bg-[var(--leaf-light)] px-3 py-1 text-xs font-extrabold text-[var(--leaf-ink)]">
                      {Math.round(suggestion.estimatedCalories)} kcal
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">{suggestion.description}</p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[var(--line)]/50 pt-4">
                  <span className="tabular-nums text-xs font-bold text-[var(--leaf-ink)]">
                    ~{Math.round(suggestion.proteinG)}g Protein
                  </span>
                  <button
                    type="button"
                    disabled={loggingSuggestions.has(suggestion) || loggedSuggestions.has(suggestion)}
                    onClick={() => void logSuggestion(suggestion)}
                    className="active-press inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--leaf)] px-4 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconLog className="size-3.5" />
                    <span>
                      {loggingSuggestions.has(suggestion)
                        ? "Saving..."
                        : loggedSuggestions.has(suggestion)
                          ? "Saved to Journal"
                          : "Log to Journal"}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && suggestions.length === 0 && !error && (
          <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-xs">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {remainingCalories !== null && remainingCalories <= 0
                ? "You have no calories remaining today."
                : "No suggestions loaded right now."}
            </p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              {remainingCalories !== null && remainingCalories <= 0 ? (
                <>
                  <Link href="/dashboard" className="font-semibold text-[var(--leaf)] underline">
                    Log exercise on Dashboard
                  </Link>{" "}
                  or check back tomorrow for new meal suggestions.
                </>
              ) : (
                'Click "Generate New Ideas" above to fetch AI recommendations.'
              )}
            </p>
          </div>
        )}

        <div className="pt-4 text-center">
          <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-1 px-3 text-xs font-bold text-[var(--leaf)] hover:underline">
            <IconChevronLeft className="size-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
