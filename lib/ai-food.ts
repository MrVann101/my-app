import { getGeminiApiKey, getGroqApiKey } from "@/lib/env";
import { nutrientRateSchema, foodWeightSchema } from "@/lib/food";
import { z } from "zod";

export const foodEstimateSchema = z.object({
  foodName: z.string().trim().min(1).max(200),
  estimatedWeightG: foodWeightSchema,
  nutrientRate: nutrientRateSchema,
  confidence: z.enum(["low", "medium", "high"]),
});

export const photoFoodEstimateSchema = foodEstimateSchema;

export const aiFoodResponseSchema = z.object({
  items: z.array(photoFoodEstimateSchema).min(1).max(10),
});

export type AiFoodResponse = z.infer<typeof aiFoodResponseSchema>;

const maxImageBytes = 10 * 1024 * 1024;
const acceptedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const visionPrompt = `Identify the food in this image and return one item per distinct, calorie-bearing food component, not one combined item for the whole plate. Separate side dishes and recognizable components of mixed dishes so each gets its own weight, nutrients, and calorie estimate. For example, chicken adobo with rice must return separate items for adobo and rice; for sinigang, return separate items for pork and major vegetables when they can be visually identified or reasonably estimated. Do not group rice with the main dish. Estimate each item's edible serving weight and nutrients per gram independently. Mark uncertain estimates low confidence and do not claim an exact recipe. Return JSON only with this exact shape: {"items":[{"foodName":"string","estimatedWeightG":number,"nutrientRate":{"caloriesPerG":number,"proteinPerG":number,"carbsPerG":number,"fatPerG":number,"fiberPerG":number,"sodiumPerG":number,"sugarPerG":number},"confidence":"low|medium|high"}]}. Do not count the plate. Use 0 only when a nutrient is unavailable; vinegar, water, and spices may have negligible calories.`;

export async function validateFoodImage(file: File): Promise<{ base64: string; mimeType: string }> {
  if (!acceptedMimeTypes.has(file.type)) throw new AiFoodError("Unsupported image type. Use JPEG, PNG, or WebP.");
  if (file.size > maxImageBytes) throw new AiFoodError("Image must be 10 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { base64: Buffer.from(bytes).toString("base64"), mimeType: file.type };
}

export async function analyzeFoodImage(input: { base64: string; mimeType: string }): Promise<AiFoodResponse & { providerUsed: "gemini" | "groq" }> {
  let geminiError: unknown;
  try {
    return { ...(await analyzeWithGemini(input)), providerUsed: "gemini" };
  } catch (error) {
    geminiError = error;
  }

  try {
    return { ...(await analyzeWithGroq(input)), providerUsed: "groq" };
  } catch (groqError) {
    throw new AiFoodError("Food image analysis is unavailable. Search the food database or enter it manually.", true, geminiError, groqError);
  }
}

export class AiFoodError extends Error {
  constructor(message: string, public readonly retryable = false, public readonly cause?: unknown, public readonly fallbackCause?: unknown) {
    super(message);
  }
}

async function analyzeWithGemini(input: { base64: string; mimeType: string }): Promise<AiFoodResponse> {
  const key = getGeminiApiKey();
  const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: visionPrompt }, { inline_data: { mime_type: input.mimeType, data: input.base64 } }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } }),
  });
  if (!response.ok) throw new AiFoodError(`Gemini returned status ${response.status}.`, response.status >= 500 || response.status === 429);
  const payload: unknown = await response.json();
  const text = readGeminiText(payload);
  return parseAiJson(text);
}

async function analyzeWithGroq(input: { base64: string; mimeType: string }): Promise<AiFoodResponse> {
  const key = getGroqApiKey();
  const response = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "meta-llama/llama-4-scout-17b-16e-instruct", temperature: 0.1, max_completion_tokens: 1200, messages: [{ role: "user", content: [{ type: "text", text: visionPrompt }, { type: "image_url", image_url: { url: `data:${input.mimeType};base64,${input.base64}` } }] }] }),
  });
  if (!response.ok) throw new AiFoodError(`Groq returned status ${response.status}.`, response.status >= 500 || response.status === 429);
  const payload: unknown = await response.json();
  const text = readGroqText(payload);
  return parseAiJson(text);
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(url, init);
    } catch (error) {
      if (attempt === 1) throw new AiFoodError("AI provider timed out or could not be reached.", true, error);
      continue;
    }
    if (response.status !== 429 && response.status < 500) return response;
  }
  return response!;
}

function parseAiJson(text: string): AiFoodResponse {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AiFoodError("AI returned malformed JSON.");
  }
  return aiFoodResponseSchema.parse(parsed);
}

function readGeminiText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) throw new AiFoodError("Gemini returned an invalid response.");
  const parts = isRecord(payload.candidates[0]) && isRecord(payload.candidates[0].content) && Array.isArray(payload.candidates[0].content.parts) ? payload.candidates[0].content.parts : [];
  const text = parts.find((part) => isRecord(part) && typeof part.text === "string");
  if (!text || !isRecord(text)) throw new AiFoodError("Gemini returned no analysis text.");
  return String(text.text);
}

function readGroqText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) throw new AiFoodError("Groq returned an invalid response.");
  const message = isRecord(payload.choices[0]) && isRecord(payload.choices[0].message) ? payload.choices[0].message : null;
  if (!message || typeof message.content !== "string") throw new AiFoodError("Groq returned no analysis text.");
  return message.content;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
