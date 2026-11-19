import { getUsdaApiKey } from "@/lib/env";
import { nutrientRateSchema } from "@/lib/food";
import type { FoodDataSource, NutrientRate } from "@/lib/types";

export type FoodSearchResult = {
  providerId: string;
  foodName: string;
  brandName: string | null;
  defaultWeightG: number;
  nutrientRate: NutrientRate;
  dataSource: Exclude<FoodDataSource, null>;
};

export class FoodProviderError extends Error {
  constructor(public readonly provider: "usda" | "off", message: string, public readonly retryable = false) {
    super(message);
  }
}

const requestTimeoutMs = 5_000;

export function formatFoodTitle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  if (trimmed === trimmed.toUpperCase()) {
    return trimmed
      .toLowerCase()
      .split(", ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(", ");
  }
  return trimmed;
}

export async function searchUsda(query: string): Promise<FoodSearchResult[]> {
  const usdaApiKey = getUsdaApiKey();
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", usdaApiKey);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "15");
  url.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS),Branded");

  const response = await fetchWithTimeout(url);
  if (response.status === 429) throw new FoodProviderError("usda", "USDA rate limit reached.", true);
  if (!response.ok) throw new FoodProviderError("usda", `USDA request failed with status ${response.status}.`, response.status >= 500);

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.foods)) throw new FoodProviderError("usda", "USDA returned an invalid response.");

  return payload.foods.flatMap((food) => normalizeUsdaFood(food));
}

export async function searchOpenFoodFacts(query: string): Promise<FoodSearchResult[]> {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "20");

  const response = await fetchWithTimeout(url);
  if (response.status === 429) throw new FoodProviderError("off", "Open Food Facts rate limit reached.", true);
  if (!response.ok) throw new FoodProviderError("off", `Open Food Facts request failed with status ${response.status}.`, response.status >= 500);

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.products)) throw new FoodProviderError("off", "Open Food Facts returned an invalid response.");

  return payload.products.flatMap((product) => normalizeOffProduct(product));
}

function normalizeUsdaFood(food: unknown): FoodSearchResult[] {
  if (!isRecord(food) || typeof food.fdcId !== "number" || typeof food.description !== "string") return [];
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const valueFor = (names: string[]) => {
    const nutrient = nutrients.find((item) => isRecord(item) && names.includes(String(item.nutrientName).toLowerCase()));
    return isRecord(nutrient) && typeof nutrient.value === "number" ? nutrient.value : 0;
  };
  const rate = nutrientRateSchema.parse({
    caloriesPerG: valueFor(["energy", "energy (kcal)"]) / 100,
    proteinPerG: valueFor(["protein"]) / 100,
    carbsPerG: valueFor(["carbohydrate, by difference", "carbohydrates"]) / 100,
    fatPerG: valueFor(["total lipid (fat)", "fat"]) / 100,
    fiberPerG: valueFor(["fiber, total dietary", "fiber"]) / 100,
    sodiumPerG: valueFor(["sodium, na"]) / 100,
    sugarPerG: valueFor(["sugars, total including nlea", "sugars"]) / 100,
  });

  return [{ providerId: String(food.fdcId), foodName: formatFoodTitle(food.description), brandName: typeof food.brandName === "string" ? food.brandName : null, defaultWeightG: 100, nutrientRate: rate, dataSource: "usda" }];
}

function normalizeOffProduct(product: unknown): FoodSearchResult[] {
  if (!isRecord(product) || typeof product.code !== "string" || typeof product.product_name !== "string") return [];
  const nutrients = isRecord(product.nutriments) ? product.nutriments : {};
  const valueFor = (key: string) => typeof nutrients[key] === "number" ? nutrients[key] : 0;
  const rate = nutrientRateSchema.parse({
    caloriesPerG: (valueFor("energy-kcal_100g") || valueFor("energy_100g") / 4.184) / 100,
    proteinPerG: valueFor("proteins_100g") / 100,
    carbsPerG: valueFor("carbohydrates_100g") / 100,
    fatPerG: valueFor("fat_100g") / 100,
    fiberPerG: valueFor("fiber_100g") / 100,
    sodiumPerG: valueFor("sodium_100g") / 1000,
    sugarPerG: valueFor("sugars_100g") / 100,
  });

  return [{ providerId: product.code, foodName: product.product_name, brandName: typeof product.brands === "string" ? product.brands : null, defaultWeightG: 100, nutrientRate: rate, dataSource: "off" }];
}

async function fetchWithTimeout(url: URL): Promise<Response> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(requestTimeoutMs), headers: { "User-Agent": "Bitewise/0.1 food search" } });
  } catch {
    throw new FoodProviderError(url.hostname.includes("usda") ? "usda" : "off", "Food provider timed out or could not be reached.", true);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
