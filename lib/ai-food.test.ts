import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiFoodError, aiFoodResponseSchema, analyzeFoodImage, validateFoodImage } from "@/lib/ai-food";

const result = { items: [{ foodName: "Chicken adobo", estimatedWeightG: 250, nutrientRate: { caloriesPerG: 1.8, proteinPerG: 0.12, carbsPerG: 0.04, fatPerG: 0.11, fiberPerG: 0, sodiumPerG: 0.004, sugarPerG: 0.01 }, confidence: "medium" }] };
const separateComponentsResult = { items: [
  ...result.items,
  { foodName: "Steamed rice", estimatedWeightG: 180, nutrientRate: { caloriesPerG: 1.3, proteinPerG: 0.025, carbsPerG: 0.28, fatPerG: 0.003, fiberPerG: 0.004, sodiumPerG: 0, sugarPerG: 0 }, confidence: "high" as const },
] };
const geminiPayload = { candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] };
const groqPayload = { choices: [{ message: { content: JSON.stringify(result) } }] };

describe("AI food analysis", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "gemini-test";
    process.env.GROQ_API_KEY = "groq-test";
    vi.restoreAllMocks();
  });

  it("validates supported image types and the 10 MB limit", async () => {
    const valid = await validateFoodImage(new File([new Uint8Array([1, 2, 3])], "meal.webp", { type: "image/webp" }));
    expect(valid.mimeType).toBe("image/webp");
    await expect(validateFoodImage(new File(["text"], "meal.txt", { type: "text/plain" }))).rejects.toThrow("Unsupported image type");
  });

  it("uses Gemini first and validates its structured response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(geminiPayload), { status: 200 }));
    const analysis = await analyzeFoodImage({ base64: "abc", mimeType: "image/jpeg" });
    expect(analysis.providerUsed).toBe("gemini");
    expect(analysis.items[0].nutrientRate.caloriesPerG).toBe(1.8);
    expect(analysis.items[0]).not.toHaveProperty("ingredients");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("models/gemini-3.5-flash-lite:generateContent"), expect.any(Object));
  });

  it("requests separate component estimates and preserves their individual calories", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(separateComponentsResult) }] } }] }), { status: 200 }));
    const analysis = await analyzeFoodImage({ base64: "abc", mimeType: "image/jpeg" });
    const requestBody = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    const prompt = requestBody.contents[0].parts[0].text as string;

    expect(prompt).toContain("one item per distinct, calorie-bearing food component");
    expect(prompt).toContain("Estimate each item's edible serving weight and nutrients per gram independently");
    expect(prompt).not.toContain("ingredient");
    expect(analysis.items.map((item) => item.foodName)).toEqual(["Chicken adobo", "Steamed rice"]);
    expect(analysis.items.map((item) => item.estimatedWeightG * item.nutrientRate.caloriesPerG)).toEqual([450, 234]);
    expect(analysis.items.every((item) => !("ingredients" in item))).toBe(true);
  });

  it("falls back to Groq when Gemini fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response("provider unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(groqPayload), { status: 200 }));
    const analysis = await analyzeFoodImage({ base64: "abc", mimeType: "image/png" });
    expect(analysis.providerUsed).toBe("groq");
  });

  it("rejects malformed output and reports a manual fallback when both fail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }), { status: 200 }));
    await expect(analyzeFoodImage({ base64: "abc", mimeType: "image/jpeg" })).rejects.toBeInstanceOf(AiFoodError);
    expect(() => aiFoodResponseSchema.parse({ items: [] })).toThrow();
  });
});
