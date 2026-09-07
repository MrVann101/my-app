"use client";

import { useState } from "react";

type Suggestion = { title: string; description: string; estimatedCalories: number; proteinG: number };

export default function SuggestionsCard() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSuggestions() {
    setIsLoading(true); setError(null);
    const response = await fetch("/api/suggestions");
    const payload = await response.json();
    setIsLoading(false);
    if (!response.ok) { setError(payload.error?.message ?? "Suggestions are unavailable."); return; }
    setSuggestions(payload.suggestions); setProvider(payload.providerUsed);
  }

  return <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">Need an idea?</p><p className="mt-1 text-sm text-[var(--ink-muted)]">Get three options sized to what remains today.</p></div><button className="rounded-xl bg-[var(--leaf)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={isLoading} onClick={loadSuggestions} type="button">{isLoading ? "Thinking..." : "Suggest"}</button></div>{error && <p className="mt-4 text-sm text-[var(--coral)]" role="alert">{error}</p>}{suggestions.length > 0 && <div className="mt-5 space-y-3">{suggestions.map((suggestion) => <div className="rounded-xl bg-[var(--surface-muted)] p-4" key={suggestion.title}><div className="flex justify-between gap-3"><p className="font-medium">{suggestion.title}</p><span className="text-xs text-[var(--ink-muted)]">{Math.round(suggestion.estimatedCalories)} kcal</span></div><p className="mt-1 text-sm text-[var(--ink-muted)]">{suggestion.description}</p><p className="mt-2 text-xs text-[var(--leaf)]">~{Math.round(suggestion.proteinG)}g protein · {provider}</p></div>)}</div>}</section>;
}
