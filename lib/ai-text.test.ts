import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeFoodText } from "@/lib/ai-text";

const response = { items: [{ foodName: "Eggs", estimatedWeightG: 100, nutrientRate: { caloriesPerG: 1.43, proteinPerG: 0.13, carbsPerG: 0.01, fatPerG: 0.1, fiberPerG: 0, sodiumPerG: 0.001, sugarPerG: 0 }, confidence: "high" }] };

describe("AI text food analysis", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "gemini-test";
    process.env.GROQ_API_KEY = "groq-test";
    vi.restoreAllMocks();
  });

  it("parses structured Gemini text output", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(response) }] } }] }), { status: 200 }));
    const result = await analyzeFoodText("two eggs");
    expect(result.providerUsed).toBe("gemini");
    expect(result.items[0].estimatedWeightG).toBe(100);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("models/gemini-3.5-flash-lite:generateContent"), expect.any(Object));
  });

  it("falls back to Groq for text parsing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("failed", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(response) } }] }), { status: 200 }));
    const result = await analyzeFoodText("two eggs");
    expect(result.providerUsed).toBe("groq");
    expect(JSON.stringify(fetchMock.mock.calls[1])).toContain("openai/gpt-oss-120b");
    const requestBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(requestBody).toMatchObject({ reasoning_effort: "low", max_completion_tokens: 1200 });
  });
});
