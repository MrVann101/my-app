"use client";

import { FormEvent, useState } from "react";
import type { NutrientRate } from "@/lib/types";

export type SearchResult = {
  providerId: string;
  foodName: string;
  brandName: string | null;
  defaultWeightG: number;
  nutrientRate: NutrientRate;
  dataSource: "usda" | "off";
};

export default function FoodSearch({ onSelect }: { onSelect: (result: SearchResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setIsSearching(true);
    setError(null);
    setSelected(null);
    const response = await fetch(`/api/food/search?q=${encodeURIComponent(query.trim())}`);
    const payload = await response.json();
    setIsSearching(false);
    if (!response.ok) {
      setError(payload.error?.message ?? "Food search is unavailable right now.");
      return;
    }
    setResults(payload.results);
  }

  return (
    <div className="space-y-5">
      <form className="flex gap-3" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="food-search">Search foods</label>
        <input id="food-search" className="h-12 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 outline-none focus:border-[var(--leaf)]" placeholder="Try rice, eggs, or yogurt" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className="h-12 rounded-xl bg-[var(--leaf)] px-5 font-semibold text-white hover:bg-[var(--leaf-deep)] disabled:opacity-50" disabled={isSearching || query.trim().length < 2} type="submit">{isSearching ? "Searching..." : "Search"}</button>
      </form>
      {error && <p className="text-sm text-[var(--coral)]" role="alert">{error}</p>}
      {results.length === 0 && !isSearching && <p className="rounded-xl bg-[var(--surface-muted)] px-4 py-4 text-sm text-[var(--ink-muted)]">Search the food database to start with a verified serving estimate.</p>}
      <div className="space-y-3">{results.map((result) => <button className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-colors ${selected?.providerId === result.providerId ? "border-[var(--leaf)] bg-[#eef7ee]" : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]"}`} key={`${result.dataSource}-${result.providerId}`} onClick={() => { setSelected(result); onSelect(result); }} type="button"><span><strong className="block font-semibold">{result.foodName}</strong><span className="mt-1 block text-xs text-[var(--ink-muted)]">{result.brandName || "Generic food"} · {result.dataSource === "usda" ? "USDA" : "Open Food Facts"}</span></span><span className="text-right text-xs text-[var(--ink-muted)]"><strong className="block text-sm text-[var(--foreground)]">{result.defaultWeightG}g</strong>{result.nutrientRate.caloriesPerG.toFixed(2)} cal/g</span></button>)}</div>
      {selected && <div className="rounded-2xl border border-[#c9dfc9] bg-[#eef7ee] p-4 text-sm text-[var(--leaf-deep)]"><strong>{selected.foodName}</strong> selected at a {selected.defaultWeightG}g starting portion. Calories will be computed from weight, not typed directly.</div>}
    </div>
  );
}
