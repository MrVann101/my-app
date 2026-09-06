import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiFoodError, aiFoodResponseSchema, analyzeFoodImage, validateFoodImage } from "@/lib/ai-food";

const result = { items: [{ foodName: "Rice", estimatedWeightG: 150, nutrientRate: { caloriesPerG: 1.3, proteinPerG: 0.02, carbsPerG: 0.28, fatPerG: 0, fiberPerG: 0, sodiumPerG: 0, sugarPerG: 0 }, confidence: "medium" }] };
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
    expect(analysis.items[0].nutrientRate.caloriesPerG).toBe(1.3);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
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
