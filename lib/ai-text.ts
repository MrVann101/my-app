import { getGeminiApiKey, getGroqApiKey } from "@/lib/env";
import { foodEstimateSchema } from "@/lib/ai-food";
import { z } from "zod";

export const aiTextResponseSchema = z.object({ items: z.array(foodEstimateSchema).min(1).max(10) });
export type AiTextResponse = z.infer<typeof aiTextResponseSchema>;

const textPrompt = `Parse this food description into individual food items. Return JSON only with this exact shape: {"items":[{"foodName":"string","estimatedWeightG":number,"nutrientRate":{"caloriesPerG":number,"proteinPerG":number,"carbsPerG":number,"fatPerG":number,"fiberPerG":number,"sodiumPerG":number,"sugarPerG":number},"confidence":"low|medium|high"}]}. Estimate grams and nutrients per gram. Never return a flat calorie total. Keep uncertain items low confidence.`;

export async function analyzeFoodText(description: string): Promise<AiTextResponse & { providerUsed: "gemini" | "groq" }> {
  const prompt = `${textPrompt}\n\nFood description: ${description.trim()}`;
  try {
    return { ...(await callGemini(prompt)), providerUsed: "gemini" };
  } catch {
    try {
      return { ...(await callGroq(prompt)), providerUsed: "groq" };
    } catch {
      throw new Error("Food description analysis is unavailable. Use search or manual entry instead.");
    }
  }
}

async function callGemini(prompt: string): Promise<AiTextResponse> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`, {
    method: "POST", signal: AbortSignal.timeout(15_000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } }),
  });
  if (!response.ok) throw new Error(`Gemini text status ${response.status}`);
  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part.text === "string")?.text;
  if (typeof text !== "string") throw new Error("Gemini text response was empty");
  return parseResponse(text);
}

async function callGroq(prompt: string): Promise<AiTextResponse> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", signal: AbortSignal.timeout(15_000), headers: { "Content-Type": "application/json", Authorization: `Bearer ${getGroqApiKey()}` }, body: JSON.stringify({ model: "openai/gpt-oss-120b", reasoning_effort: "low", temperature: 0.1, max_completion_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) throw new Error(`Groq text status ${response.status}`);
  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("Groq text response was empty");
  return parseResponse(text);
}

function parseResponse(text: string): AiTextResponse {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return aiTextResponseSchema.parse(JSON.parse(cleaned));
}
