"use client";

import { FormEvent, useState } from "react";
import type { NutrientRate } from "@/lib/types";
import { IconSearch } from "@/components/icons";

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
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setIsSearching(true);
    setError(null);
    onSelect?.(null);
    const response = await fetch(`/api/food/search?q=${encodeURIComponent(query.trim())}`);
    const payload = await response.json();
    setIsSearching(false);
    if (!response.ok) {
      setError(payload.error?.message ?? "Food search is unavailable right now.");
      return;
    }
    setResults(payload.results);
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    setError(null);
    onSelect?.(null);
  }

  function handleAddResult(result: SearchResult) {
    if (onAdd) {
      onAdd(result);
      setQuery("");
      setResults([]);
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
            className="h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] pl-4 pr-9 text-sm outline-none transition-colors focus:border-[var(--leaf)]"
            placeholder="Search food name (e.g. chicken, rice, egg)..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-3 text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--foreground)]"
            >
              ✕
            </button>
          )}
        </div>
        <button
          className="active-press flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--leaf)] text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
          disabled={isSearching || query.trim().length < 2}
          type="submit"
          title="Search food database"
          aria-label="Search food database"
        >
          <IconSearch className="size-5" />
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/10 p-4 text-xs font-semibold text-[var(--coral)]" role="alert">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">
              Showing top {results.length} general matches
            </p>
            <span className="text-[11px] font-medium text-[var(--leaf-ink)]">Verified database</span>
          </div>
          {results.map((result) => {
            const isChosen = selectedResult?.providerId === result.providerId;
            const isGeneric = !result.brandName;
            return (
              <div
                key={`${result.dataSource}-${result.providerId}`}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all ${
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
                    <span className="tabular-nums text-[var(--ink-muted)]">{result.defaultWeightG}g portion</span>
                    <span>·</span>
                    <span className="tabular-nums text-[var(--ink-muted)]">P {Math.round(result.nutrientRate.proteinPerG * result.defaultWeightG)}g</span>
                    <span>·</span>
                    <span className="tabular-nums text-[var(--ink-muted)]">C {Math.round(result.nutrientRate.carbsPerG * result.defaultWeightG)}g</span>
                    <span>·</span>
                    <span className="tabular-nums text-[var(--ink-muted)]">F {Math.round(result.nutrientRate.fatPerG * result.defaultWeightG)}g</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddResult(result)}
                  className="active-press shrink-0 inline-flex min-h-11 min-w-16 items-center justify-center rounded-xl bg-[var(--leaf)] px-3.5 py-2 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)]"
                >
                  <span>+ Add</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedResult && !onAdd && (
        <div className="rounded-xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-4 text-xs font-medium text-[var(--leaf-ink)] flex items-center justify-between">
          <span>
            ✓ Selected <strong>{selectedResult.foodName}</strong> ({selectedResult.defaultWeightG}g default).
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="text-xs font-bold text-[var(--leaf-ink)] underline hover:opacity-80"
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}
