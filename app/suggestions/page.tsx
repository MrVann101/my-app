"use client";

import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/app-shell";
import { IconSparkles, IconLog } from "@/components/icons";
import Link from "next/link";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";

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
      setIsLoading(false);
      if (!response.ok) {
        setError(payload.error?.message ?? "Suggestions are currently unavailable.");
        return;
      }
      setRemainingCalories(payload.remainingCalories ?? null);
      setLogDate(payload.date ?? null);
      setSuggestions((payload.suggestions ?? []).filter((suggestion: Suggestion) =>
        typeof payload.remainingCalories === "number" && suggestion.estimatedCalories <= payload.remainingCalories
      ));
      setProvider(payload.providerUsed ?? null);
    } catch {
      setIsLoading(false);
      setError("Unable to load suggestions.");
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
        setIsLoading(false);

        if (!response.ok) {
          setError(payload.error?.message ?? "Suggestions are currently unavailable.");
          return;
        }

        setRemainingCalories(payload.remainingCalories ?? null);
        setLogDate(payload.date ?? null);
        setSuggestions((payload.suggestions ?? []).filter((suggestion: Suggestion) =>
          typeof payload.remainingCalories === "number" && suggestion.estimatedCalories <= payload.remainingCalories
        ));
        setProvider(payload.providerUsed ?? null);
      } catch {
        if (!active) return;
        setIsLoading(false);
        setError("Unable to load suggestions.");
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
      const response = await fetch("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate: logDate ?? getBrowserDate(),
          timezone: getBrowserTimezone(),
          mealType: "snack",
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
      setLoggedStatus(`✓ Added "${suggestion.title}" (${Math.round(suggestion.estimatedCalories)} kcal) to today's log!`);
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
    <AppShell eyebrow="AI Ideas" title="AI Meal Suggestions">
      <div className="space-y-6">
        {/* Banner */}
        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">Matched to Your Remaining Calories</h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              These suggestions are generated using AI vision/text models based on what remains in your daily budget.
            </p>
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void loadSuggestions()}
            className="active-press inline-flex items-center gap-2 rounded-xl bg-[var(--leaf)] px-4 py-2.5 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
          >
            <IconSparkles className="size-4" />
            <span>{isLoading ? "Generating..." : "Generate New Ideas"}</span>
          </button>
        </div>

        {loggedStatus && (
          <div className="rounded-2xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-4 text-xs font-bold text-[var(--leaf-ink)]">
            {loggedStatus}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-[var(--coral)]/30 bg-[var(--coral)]/10 p-4 text-xs font-bold text-[var(--coral)]" role="alert">
            {error}
          </div>
        )}

        {remainingCalories !== null && !isLoading && !error && (
          <p className="text-sm font-semibold text-[var(--ink-muted)]" aria-live="polite">
            Meals below your remaining budget of {Math.max(0, Math.round(remainingCalories)).toLocaleString()} kcal
          </p>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-32 rounded-2xl bg-[var(--surface-muted)]" />
            <div className="h-32 rounded-2xl bg-[var(--surface-muted)]" />
            <div className="h-32 rounded-2xl bg-[var(--surface-muted)]" />
          </div>
        )}

        {/* Suggestions List */}
        {!isLoading && suggestions.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.title}-${index}`}
                className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs transition-all hover:border-[var(--leaf)]/50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-[var(--foreground)]">{suggestion.title}</h3>
                    <span className="tabular-nums rounded-full bg-[var(--leaf-light)] px-3 py-1 text-xs font-extrabold text-[var(--leaf)]">
                      {Math.round(suggestion.estimatedCalories)} kcal
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">{suggestion.description}</p>
                </div>

                <div className="mt-5 border-t border-[var(--line)]/50 pt-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--leaf-ink)]">
                    ~{Math.round(suggestion.proteinG)}g Protein
                  </span>
                  <button
                    type="button"
                    disabled={loggingSuggestions.has(suggestion) || loggedSuggestions.has(suggestion)}
                    onClick={() => void logSuggestion(suggestion)}
                    className="active-press inline-flex items-center gap-1.5 rounded-xl bg-[var(--leaf)] px-3.5 py-2 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:cursor-not-allowed disabled:opacity-50"
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

        {/* Empty state */}
        {!isLoading && suggestions.length === 0 && !error && (
          <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-xs">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {remainingCalories !== null && remainingCalories <= 0 ? "You have no calories remaining today." : "No suggestions loaded right now."}
            </p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              {remainingCalories !== null && remainingCalories <= 0
                ? "Log exercise or generate ideas tomorrow to see meal suggestions."
                : "Click &quot;Generate New Ideas&quot; above to fetch AI recommendations."}
            </p>
          </div>
        )}

        <div className="text-center pt-4">
          <Link href="/dashboard" className="text-xs font-bold text-[var(--leaf)] hover:underline">
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
