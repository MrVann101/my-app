import { getGeminiApiKey, getGroqApiKey } from "@/lib/env";
import { z } from "zod";

export const suggestionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(300),
  estimatedCalories: z.number().finite().nonnegative().max(5000),
  proteinG: z.number().finite().nonnegative().max(500),
});

export const suggestionsResponseSchema = z.object({ suggestions: z.array(suggestionSchema).length(3) });
export type SuggestionsResponse = z.infer<typeof suggestionsResponseSchema>;

const unsupportedMedicalClaim = /cure|treat|diagnos|prevent disease|medical advice|guarantee weight loss/i;

export function containsUnsupportedMedicalClaim(text: string): boolean {
  return unsupportedMedicalClaim.test(text);
}

export type SuggestionBudget = { calories: number; proteinG: number; carbsG: number; fatG: number };

export async function getMealSuggestions(budget: SuggestionBudget): Promise<SuggestionsResponse & { providerUsed: "gemini" | "groq" | "fallback" }> {
  const prompt = `Suggest exactly 3 simple meals for this remaining budget: ${JSON.stringify(budget)}. Return JSON only: {"suggestions":[{"title":"string","description":"string","estimatedCalories":number,"proteinG":number}]}. Every suggestion must stay under the calorie budget and should support the remaining protein target. Avoid medical claims.`;
  try {
    return { ...(await callGemini(prompt, budget)), providerUsed: "gemini" };
  } catch {
    try {
      return { ...(await callGroq(prompt, budget)), providerUsed: "groq" };
    } catch {
      return { suggestions: fallbackSuggestions(budget), providerUsed: "fallback" };
    }
  }
}

async function callGemini(prompt: string, budget: SuggestionBudget): Promise<SuggestionsResponse> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`, { method: "POST", signal: AbortSignal.timeout(10_000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.4 } }) });
  if (!response.ok) throw new Error(`Gemini suggestions status ${response.status}`);
  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part.text === "string")?.text;
  if (typeof text !== "string") throw new Error("Gemini suggestions response was empty");
  return validateSuggestions(text, budget);
}

async function callGroq(prompt: string, budget: SuggestionBudget): Promise<SuggestionsResponse> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", signal: AbortSignal.timeout(10_000), headers: { "Content-Type": "application/json", Authorization: `Bearer ${getGroqApiKey()}` }, body: JSON.stringify({ model: "llama-3.3-70b-versatile", temperature: 0.4, max_tokens: 1000, messages: [{ role: "user", content: prompt }] }) });
  if (!response.ok) throw new Error(`Groq suggestions status ${response.status}`);
  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("Groq suggestions response was empty");
  return validateSuggestions(text, budget);
}

function validateSuggestions(text: string, budget: SuggestionBudget): SuggestionsResponse {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = suggestionsResponseSchema.parse(JSON.parse(cleaned));
  if (parsed.suggestions.some((suggestion) => suggestion.estimatedCalories > Math.max(budget.calories, 0))) throw new Error("Suggestion exceeds calorie budget");
  if (parsed.suggestions.some((suggestion) => containsUnsupportedMedicalClaim(`${suggestion.title} ${suggestion.description}`))) throw new Error("Suggestion contains an unsupported medical claim");
  return parsed;
}

function fallbackSuggestions(budget: SuggestionBudget) {
  const calories = Math.max(0, Math.floor(budget.calories));
  const protein = Math.max(0, Math.floor(budget.proteinG));
  return [
    { title: "Greek yogurt and fruit", description: "Greek yogurt with berries and a small handful of oats.", estimatedCalories: Math.min(calories, 280), proteinG: Math.min(protein, 22) },
    { title: "Chicken grain bowl", description: "Chicken, rice, greens, and a light yogurt dressing.", estimatedCalories: Math.min(calories, 520), proteinG: Math.min(protein, 38) },
    { title: "Tuna toast", description: "Tuna mixed with yogurt on whole-grain toast with cucumber.", estimatedCalories: Math.min(calories, 360), proteinG: Math.min(protein, 30) },
  ];
}
