import { searchOpenFoodFacts, searchUsda, type FoodSearchResult } from "@/lib/food-providers";

const cacheTtlMs = 5 * 60 * 1000;
const searchCache = new Map<string, { expiresAt: number; value: { results: FoodSearchResult[]; providerUsed: "usda" | "off" | "none" } }>();

export class FoodSearchError extends Error {
  constructor(message: string, public readonly retryable = false) {
    super(message);
  }
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
    if (usdaResults.length > 0) return cacheResult(cacheKey, { results: usdaResults, providerUsed: "usda" });
  } catch {
    // USDA failure or no results falls through to Open Food Facts.
  }

  try {
    const offResults = await searchOpenFoodFacts(normalizedQuery);
    return cacheResult(cacheKey, { results: offResults, providerUsed: offResults.length > 0 ? "off" : "none" });
  } catch (error) {
    throw new FoodSearchError("Food search providers are temporarily unavailable.", error instanceof Error && error.message.includes("rate limit"));
  }
}

function cacheResult(cacheKey: string, value: { results: FoodSearchResult[]; providerUsed: "usda" | "off" | "none" }) {
  searchCache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs, value });
  return value;
}
