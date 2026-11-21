"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { NutrientRate } from "@/lib/types";
import { IconCheck, IconSearch, IconX } from "@/components/icons";

export type SearchResult = {
  providerId: string;
  foodName: string;
  brandName: string | null;
  defaultWeightG: number;
  nutrientRate: NutrientRate;
  dataSource: "usda" | "off";
};

export default function FoodSearch({
  onSelect,
  onAdd,
  selectedResult,
}: {
  onSelect?: (result: SearchResult | null) => void;
  onAdd?: (result: SearchResult) => void;
  selectedResult?: SearchResult | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function runSearch(rawQuery: string) {
    const trimmed = rawQuery.trim();
    if (trimmed.length < 2) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch(`/api/food/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Food search is unavailable right now.");
        return;
      }
      setResults(payload.results ?? []);
      setLastSearchedQuery(trimmed);
      setHasSearched(true);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError("Unable to search foods. Check your connection and try again.");
    } finally {
      if (abortRef.current === controller) {
        setIsSearching(false);
      }
    }
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      abortRef.current?.abort();
      const timer = window.setTimeout(() => {
        setIsSearching(false);
        setResults([]);
        setHasSearched(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      void runSearch(trimmed);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [query]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    onSelect?.(null);
    void runSearch(query);
  }

  function handleClear() {
    abortRef.current?.abort();
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setLastSearchedQuery("");
    setError(null);
    setIsSearching(false);
    onSelect?.(null);
  }

  function handleSelectResult(result: SearchResult) {
    if (onAdd) {
      onAdd(result);
      setQuery("");
      setResults([]);
      setHasSearched(false);
      setError(null);
    } else {
      onSelect?.(result);
    }
  }

  return (
    <div className="space-y-4">
      <form className="flex gap-2 sm:gap-3" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="food-search">
          Search foods
        </label>
        <div className="relative flex-1">
          <input
            id="food-search"
            className="h-12 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] pl-4 pr-12 text-sm outline-none transition-colors focus:border-[var(--leaf)]"
            placeholder="Search food name (e.g. chicken, rice, egg)..."
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear food search"
              className="active-press absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            >
              <IconX className="size-4" />
            </button>
          )}
        </div>
        <button
          className="active-press flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--leaf)] text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
          disabled={isSearching || query.trim().length < 2}
          type="submit"
          title="Search food database"
          aria-label="Search food database"
        >
          <IconSearch className="size-5" />
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] p-4 text-xs font-semibold text-[var(--coral)]" role="alert">
          {error}
        </p>
      )}

      {isSearching && (
        <div className="space-y-2" aria-live="polite" aria-label="Searching foods">
          <div className="h-16 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
          <div className="h-16 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        </div>
      )}

      {!isSearching && hasSearched && results.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-muted)]/60 p-4 text-xs text-[var(--ink-muted)]" role="status">
          No database matches for <strong className="text-[var(--foreground)]">&quot;{lastSearchedQuery}&quot;</strong>. Enter the food name and calories manually below, or describe your meal in Text AI.
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">
              Showing {results.length} database {results.length === 1 ? "match" : "matches"}
            </p>
            <span className="text-[11px] font-medium text-[var(--leaf-ink)]">Verified database</span>
          </div>
          {results.map((result) => {
            const isChosen = selectedResult?.providerId === result.providerId;
            const isGeneric = !result.brandName;
            return (
              <div
                key={`${result.dataSource}-${result.providerId}`}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-colors ${
                  isChosen
                    ? "border-[var(--leaf)] bg-[var(--leaf-light)] text-[var(--leaf-ink)] shadow-2xs"
                    : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--leaf)]/40 hover:bg-[var(--surface-muted)]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="truncate text-sm font-bold text-[var(--foreground)]">{result.foodName}</strong>
                    {isGeneric ? (
                      <span className="shrink-0 rounded-md bg-[var(--leaf-light)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--leaf-ink)]">
                        Whole food
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]">
                        {result.brandName}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--ink-muted)]">
                    <span className="tabular-nums font-semibold text-[var(--leaf)]">
                      {Math.round(result.nutrientRate.caloriesPerG * result.defaultWeightG)} kcal
                    </span>
                    <span>·</span>
                    <span className="tabular-nums">{result.defaultWeightG}g portion</span>
                    <span>·</span>
                    <span className="tabular-nums">P {Math.round(result.nutrientRate.proteinPerG * result.defaultWeightG)}g</span>
                    <span>·</span>
                    <span className="tabular-nums">C {Math.round(result.nutrientRate.carbsPerG * result.defaultWeightG)}g</span>
                    <span>·</span>
                    <span className="tabular-nums">F {Math.round(result.nutrientRate.fatPerG * result.defaultWeightG)}g</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectResult(result)}
                  className="active-press inline-flex min-h-11 min-w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--leaf)] px-3.5 py-2 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)]"
                >
                  <span>Select</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedResult && !onAdd && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-4 text-xs font-medium text-[var(--leaf-ink)]">
          <span className="inline-flex items-center gap-1.5">
            <IconCheck className="size-4 shrink-0" />
            <span>
              Selected <strong>{selectedResult.foodName}</strong> ({selectedResult.defaultWeightG}g default).
            </span>
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="min-h-11 shrink-0 px-2 text-xs font-bold text-[var(--leaf-ink)] underline hover:opacity-80"
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}
