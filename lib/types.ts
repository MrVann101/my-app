export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type FoodSource = "ai_photo" | "ai_text" | "database" | "manual";
export type FoodDataSource = "usda" | "off" | "gemini" | "groq" | null;
export type Confidence = "low" | "medium" | "high";

export type NutrientRate = {
  caloriesPerG: number;
  proteinPerG: number;
  carbsPerG: number;
  fatPerG: number;
  fiberPerG: number;
  sodiumPerG: number;
  sugarPerG: number;
};

export type ComputedNutrients = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  sugarG: number;
};

export type Profile = {
  userId: string;
  username: string;
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel;
  goal: Goal;
  timezone: string;
  bmr: number | null;
  tdee: number | null;
  targetCalories: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  deletionRequestedAt: string | null;
  updatedAt: string;
};

export type FoodEstimate = NutrientRate & {
  foodName: string;
  estimatedWeightG: number;
  confidence: Confidence;
  providerUsed: "gemini" | "groq" | "manual";
};

export type FoodLogInput = {
  logDate: string;
  mealType: MealType;
  foodName: string;
  weightG: number;
  nutrientRate: NutrientRate;
  source: FoodSource;
  dataSource: FoodDataSource;
  aiConfidence: Confidence | null;
  photoUrl?: string | null;
};

export type FoodLog = FoodLogInput & ComputedNutrients & {
  id: number;
  userId: string;
  createdAt: string;
};

export type MealPlanItem = FoodLogInput & ComputedNutrients & {
  id: number;
  planId: number;
};

export type MealPlan = {
  id: number;
  userId: string;
  name: string;
  visibility: "private" | "public";
  goal: Goal | null;
  dietType: string | null;
  totalCalories: number;
  forkedFrom: number | null;
  saveCount: number;
  items: MealPlanItem[];
  createdAt: string;
};

export type DailySummary = {
  userId: string;
  summaryDate: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  totalFiberG: number;
  totalSodiumMg: number;
  totalSugarG: number;
  caloriesBurned: number;
  hitTarget: boolean;
  loggedAtLeastOnce: boolean;
};

export type AiTextEstimate = {
  foodName: string;
  estimatedWeightG: number;
  nutrientRate: NutrientRate;
  confidence: Confidence;
};

export type AiAnalysisResponse = {
  items: AiTextEstimate[];
  providerUsed: "gemini" | "groq" | "manual";
  fallbackRequired: boolean;
};
