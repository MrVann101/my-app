import { searchOpenFoodFacts, searchUsda, type FoodSearchResult } from "@/lib/food-providers";

const cacheTtlMs = 5 * 60 * 1000;
const maxCacheEntries = 500;
const searchCache = new Map<string, { expiresAt: number; value: { results: FoodSearchResult[]; providerUsed: "usda" | "off" | "none" } }>();

export class FoodSearchError extends Error {
  constructor(message: string, public readonly retryable = false) {
    super(message);
  }
}

export function prioritizeGeneralFoods(results: FoodSearchResult[], query: string): FoodSearchResult[] {
  const q = query.trim().toLowerCase();
  return [...results].sort((a, b) => {
    const aIsGeneric = !a.brandName;
    const bIsGeneric = !b.brandName;
    if (aIsGeneric && !bIsGeneric) return -1;
    if (!aIsGeneric && bIsGeneric) return 1;

    const aExact = a.foodName.toLowerCase() === q;
    const bExact = b.foodName.toLowerCase() === q;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    const aStarts = a.foodName.toLowerCase().startsWith(q);
    const bStarts = b.foodName.toLowerCase().startsWith(q);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    return 0;
  });
}

export async function searchFoods(query: string): Promise<{ results: FoodSearchResult[]; providerUsed: "usda" | "off" | "none" }> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return { results: [], providerUsed: "none" };
  const cacheKey = normalizedQuery.toLocaleLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  searchCache.delete(cacheKey);

  try {
    const usdaResults = await searchUsda(normalizedQuery);
    if (usdaResults.length > 0) {
      const filtered = prioritizeGeneralFoods(usdaResults, normalizedQuery).slice(0, 8);
      return cacheResult(cacheKey, { results: filtered, providerUsed: "usda" });
    }
  } catch {
    // USDA failure or no results falls through to Open Food Facts.
  }

  try {
    const offResults = await searchOpenFoodFacts(normalizedQuery);
    const filtered = prioritizeGeneralFoods(offResults, normalizedQuery).slice(0, 8);
    return cacheResult(cacheKey, { results: filtered, providerUsed: filtered.length > 0 ? "off" : "none" });
  } catch (error) {
    throw new FoodSearchError("Food search providers are temporarily unavailable.", error instanceof Error && error.message.includes("rate limit"));
  }
}

function cacheResult(cacheKey: string, value: { results: FoodSearchResult[]; providerUsed: "usda" | "off" | "none" }) {
  const now = Date.now();
  if (searchCache.size >= maxCacheEntries) {
    for (const [key, entry] of searchCache.entries()) {
      if (entry.expiresAt <= now) searchCache.delete(key);
    }
    if (searchCache.size >= maxCacheEntries) {
      const oldestKey = searchCache.keys().next().value;
      if (oldestKey) searchCache.delete(oldestKey);
    }
  }
  searchCache.set(cacheKey, { expiresAt: now + cacheTtlMs, value });
  return value;
}
