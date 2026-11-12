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
type MealSuggestion = z.infer<typeof suggestionSchema>;
type MealSuggestionsResult = { suggestions: MealSuggestion[]; providerUsed: "gemini" | "groq" | "fallback" };

export async function getMealSuggestions(budget: SuggestionBudget, excludedTitles: string[] = [], generation = 0): Promise<MealSuggestionsResult> {
  if (budget.calories <= 0) return { suggestions: [], providerUsed: "fallback" };
  const prompt = `Suggest exactly 3 simple meals for idea set ${generation}, using this remaining budget: ${JSON.stringify(budget)}. Do not suggest any of these meals: ${JSON.stringify(excludedTitles)}. Make every suggestion different from those excluded meals. Return JSON only: {"suggestions":[{"title":"string","description":"string","estimatedCalories":number,"proteinG":number}]}. Every suggestion must stay under the calorie budget and should support the remaining protein target. Avoid medical claims.`;
  try {
    return { ...(await callGemini(prompt, budget, excludedTitles)), providerUsed: "gemini" };
  } catch {
    try {
      return { ...(await callGroq(prompt, budget, excludedTitles)), providerUsed: "groq" };
    } catch {
      return { suggestions: fallbackSuggestions(budget, excludedTitles, generation), providerUsed: "fallback" };
    }
  }
}

async function callGemini(prompt: string, budget: SuggestionBudget, excludedTitles: string[]): Promise<SuggestionsResponse> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`, { method: "POST", signal: AbortSignal.timeout(10_000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.4 } }) });
  if (!response.ok) throw new Error(`Gemini suggestions status ${response.status}`);
  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part.text === "string")?.text;
  if (typeof text !== "string") throw new Error("Gemini suggestions response was empty");
  return validateSuggestions(text, budget, excludedTitles);
}

async function callGroq(prompt: string, budget: SuggestionBudget, excludedTitles: string[]): Promise<SuggestionsResponse> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", signal: AbortSignal.timeout(10_000), headers: { "Content-Type": "application/json", Authorization: `Bearer ${getGroqApiKey()}` }, body: JSON.stringify({ model: "openai/gpt-oss-120b", reasoning_effort: "low", temperature: 0.4, max_completion_tokens: 1000, messages: [{ role: "user", content: prompt }] }) });
  if (!response.ok) throw new Error(`Groq suggestions status ${response.status}`);
  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("Groq suggestions response was empty");
  return validateSuggestions(text, budget, excludedTitles);
}

function validateSuggestions(text: string, budget: SuggestionBudget, excludedTitles: string[]): SuggestionsResponse {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = suggestionsResponseSchema.parse(JSON.parse(cleaned));
  if (parsed.suggestions.some((suggestion) => suggestion.estimatedCalories > Math.max(budget.calories, 0))) throw new Error("Suggestion exceeds calorie budget");
  const excluded = new Set(excludedTitles.map(normalizeTitle));
  if (parsed.suggestions.some((suggestion) => excluded.has(normalizeTitle(suggestion.title)))) throw new Error("Suggestion repeats a previously shown meal");
  if (parsed.suggestions.some((suggestion) => containsUnsupportedMedicalClaim(`${suggestion.title} ${suggestion.description}`))) throw new Error("Suggestion contains an unsupported medical claim");
  return parsed;
}

function fallbackSuggestions(budget: SuggestionBudget, excludedTitles: string[] = [], generation = 0) {
  const calories = Math.max(0, Math.floor(budget.calories));
  const protein = Math.max(0, Math.floor(budget.proteinG));
  const excluded = new Set(excludedTitles.map(normalizeTitle));
  const mealIdeas = [
    { title: "Greek yogurt and fruit", description: "Greek yogurt with berries and a small handful of oats.", estimatedCalories: Math.min(calories, 280), proteinG: Math.min(protein, 22) },
    { title: "Chicken grain bowl", description: "Chicken, rice, greens, and a light yogurt dressing.", estimatedCalories: Math.min(calories, 520), proteinG: Math.min(protein, 38) },
    { title: "Tuna toast", description: "Tuna mixed with yogurt on whole-grain toast with cucumber.", estimatedCalories: Math.min(calories, 360), proteinG: Math.min(protein, 30) },
    { title: "Lentil and spinach soup", description: "A warm lentil soup with spinach and whole-grain bread.", estimatedCalories: Math.min(calories, 390), proteinG: Math.min(protein, 24) },
    { title: "Salmon and roasted vegetables", description: "Baked salmon served with a mix of roasted seasonal vegetables.", estimatedCalories: Math.min(calories, 480), proteinG: Math.min(protein, 34) },
    { title: "Tofu veggie stir-fry", description: "Tofu and colorful vegetables quickly stir-fried with a light sauce.", estimatedCalories: Math.min(calories, 350), proteinG: Math.min(protein, 22) },
    { title: "Cottage cheese power bowl", description: "Cottage cheese topped with sliced tomato, cucumber, and herbs.", estimatedCalories: Math.min(calories, 260), proteinG: Math.min(protein, 28) },
    { title: "Turkey lettuce wraps", description: "Seasoned turkey with crunchy vegetables wrapped in lettuce leaves.", estimatedCalories: Math.min(calories, 320), proteinG: Math.min(protein, 30) },
    { title: "Chickpea quinoa salad", description: "Quinoa, chickpeas, cucumber, and greens with lemon dressing.", estimatedCalories: Math.min(calories, 430), proteinG: Math.min(protein, 18) },
  ];
  const offset = (Math.max(0, Math.floor(generation)) * 3) % mealIdeas.length;
  const rotatedIdeas = [...mealIdeas.slice(offset), ...mealIdeas.slice(0, offset)];
  return rotatedIdeas.filter((suggestion) => !excluded.has(normalizeTitle(suggestion.title))).slice(0, 3);
}

function normalizeTitle(title: string): string {
  return title.trim().toLocaleLowerCase();
}
