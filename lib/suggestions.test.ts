import { beforeEach, describe, expect, it, vi } from "vitest";
import { containsUnsupportedMedicalClaim, getMealSuggestions } from "@/lib/suggestions";

const budget = { calories: 700, proteinG: 50, carbsG: 80, fatG: 25 };
const response = { suggestions: [{ title: "Meal one", description: "Simple meal one", estimatedCalories: 300, proteinG: 25 }, { title: "Meal two", description: "Simple meal two", estimatedCalories: 400, proteinG: 30 }, { title: "Meal three", description: "Simple meal three", estimatedCalories: 500, proteinG: 35 }] };

describe("meal suggestions", () => {
  beforeEach(() => { process.env.GEMINI_API_KEY = "gemini-test"; process.env.GROQ_API_KEY = "groq-test"; vi.restoreAllMocks(); });

  it("uses Gemini output when valid and within budget", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(response) }] } }] }), { status: 200 }));
    const result = await getMealSuggestions(budget);
    expect(result.providerUsed).toBe("gemini");
    expect(result.suggestions).toHaveLength(3);
  });

  it("falls back to Groq and then deterministic suggestions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("failed", { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(response) } }] }), { status: 200 }));
    expect((await getMealSuggestions(budget)).providerUsed).toBe("groq");
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect((await getMealSuggestions(budget)).providerUsed).toBe("fallback");
  });

  it("rejects AI suggestions that exceed the budget and falls back", async () => {
    const tooLarge = { suggestions: response.suggestions.map((item) => ({ ...item, estimatedCalories: 900 })) };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(tooLarge) }] } }] }), { status: 200 }));
    expect((await getMealSuggestions(budget)).providerUsed).toBe("fallback");
  });

  it("rejects unsupported medical claims and falls back", async () => {
    const unsafe = { suggestions: response.suggestions.map((item) => ({ ...item, description: "This meal can cure diabetes." })) };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(unsafe) }] } }] }), { status: 200 }));
    expect(containsUnsupportedMedicalClaim(unsafe.suggestions[0].description)).toBe(true);
    expect((await getMealSuggestions(budget)).providerUsed).toBe("fallback");
  });
});
