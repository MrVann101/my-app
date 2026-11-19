import { z } from "zod";
import { foodWeightSchema, nutrientRateSchema } from "@/lib/food";

export const foodLogInputSchema = z.object({
  logDate: z.iso.date(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  foodName: z.string().trim().min(1).max(200),
  weightG: foodWeightSchema,
  nutrientRate: nutrientRateSchema,
  source: z.enum(["ai_photo", "ai_text", "database", "manual"]),
  dataSource: z.enum(["usda", "off", "gemini", "groq"]).nullable().default(null),
  aiConfidence: z.enum(["low", "medium", "high"]).nullable().default(null),
  isRecipe: z.boolean().default(false),
  photoUrl: z.string().url().nullable().optional(),
  timezone: z.string().min(1).max(100).optional(),
});

export const foodLogBatchInputSchema = z.array(foodLogInputSchema).min(1).max(100);
export const foodLogRequestSchema = z.union([foodLogInputSchema, foodLogBatchInputSchema]);

export type FoodLogInput = z.infer<typeof foodLogInputSchema>;
export type FoodLogRequest = z.infer<typeof foodLogRequestSchema>;
