import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchFoods } from "@/lib/food-search";

const usdaResponse = { foods: [{ fdcId: 1, description: "Rice", foodNutrients: [{ nutrientName: "Energy", value: 130 }, { nutrientName: "Protein", value: 2.7 }, { nutrientName: "Carbohydrate, by difference", value: 28 }, { nutrientName: "Total lipid (fat)", value: 0.3 }] }] };
const offResponse = { products: [{ code: "123", product_name: "Fallback snack", nutriments: { "energy-kcal_100g": 200, proteins_100g: 5, carbohydrates_100g: 20, fat_100g: 8 } }] };

describe("food provider search", () => {
  beforeEach(() => {
    process.env.USDA_API_KEY = "DEMO_KEY";
    vi.restoreAllMocks();
  });

  it("returns USDA results first", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(usdaResponse), { status: 200 }));
    const result = await searchFoods("rice");
    expect(result.providerUsed).toBe("usda");
    expect(result.results[0].nutrientRate.caloriesPerG).toBe(1.3);
  });

  it("falls back to Open Food Facts when USDA fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("upstream failure", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(offResponse), { status: 200 }));
    const result = await searchFoods("snack");
    expect(result.providerUsed).toBe("off");
    expect(result.results[0].foodName).toBe("Fallback snack");
  });

  it("returns no results for an empty query", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await searchFoods("   ")).toEqual({ results: [], providerUsed: "none" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("caches repeated normalized queries briefly", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(usdaResponse), { status: 200 }));
    await searchFoods("  rice cache ");
    await searchFoods("rice cache");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
