import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPlanRecipe,
  availableIngredientsSchema,
  estimateMealNutrition,
  generateRecipe,
  generatedRecipeSchema,
  isKnownIngredient,
  mealNutritionRequestSchema,
  recipeSuggestionsSchema,
  suggestIngredientCorrection,
  suggestIngredients,
  suggestRecipes,
  validatePlanRecipe,
} from "./recipes";

describe("plan recipes", () => {
  it("suggests common ingredients and matches close spelling mistakes", () => {
    expect(suggestIngredients("chikcen")).toContain("chicken");
    expect(suggestIngredientCorrection("chikcen")).toBe("chicken");
    expect(suggestIngredients("tom")).toContain("tomato");
    expect(suggestIngredientCorrection("chicken")).toBeNull();
  });

  it("leaves unfamiliar ingredient names unchanged", () => {
    expect(suggestIngredientCorrection("dragonfruit")).toBeNull();
  });

  it("accepts common ingredient names and plurals but rejects unrelated search text", () => {
    expect(isKnownIngredient("chicken")).toBe(true);
    expect(isKnownIngredient("tomatoes")).toBe(true);
    expect(isKnownIngredient("dragonfruit")).toBe(false);
    expect(isKnownIngredient("weather forecast")).toBe(false);
    expect(availableIngredientsSchema.safeParse(["chicken", "tomatoes"]).success).toBe(true);
    expect(availableIngredientsSchema.safeParse(["weather forecast"]).success).toBe(false);
  });

  it("builds a bounded recipe from plan items only", () => {
    const recipe = buildPlanRecipe("Lunch", [{ food_name: "Rice", weight_g: 150 }, { food_name: "Egg", weight_g: 50 }]);
    expect(recipe.ingredients.map((item) => item.name)).toEqual(["Rice", "Egg"]);
    expect(recipe.steps.length).toBeGreaterThan(0);
  });

  it("rejects ingredients outside the plan", () => {
    expect(() => validatePlanRecipe({ title: "Test", cookTimeMinutes: 20, ingredients: [{ name: "Salt", amount: "1g" }], steps: ["Mix."] }, ["Rice"])).toThrow("outside the meal plan");
  });

  it("requires exactly five meal ideas with estimated nutrition and cooking times", () => {
    const suggestion = {
      title: "Chicken rice bowl",
      description: "Chicken and rice with tomatoes.",
      cookTimeMinutes: 25,
      servings: 2,
      nutrition: { calories: 420, proteinG: 32, carbsG: 48, fatG: 11 },
    };
    expect(recipeSuggestionsSchema.parse({ suggestions: Array(5).fill(suggestion) }).suggestions).toHaveLength(5);
    expect(() => recipeSuggestionsSchema.parse({ suggestions: Array(3).fill(suggestion) })).toThrow();
    expect(() => recipeSuggestionsSchema.parse({ suggestions: Array(6).fill(suggestion) })).toThrow();
  });

  it("requires a generated recipe to include quantities, cooking steps, and nutrition", () => {
    expect(generatedRecipeSchema.parse({
      title: "Chicken rice bowl",
      description: "A quick chicken and rice dinner.",
      cookTimeMinutes: 25,
      servings: 2,
      nutrition: { calories: 420, proteinG: 32, carbsG: 48, fatG: 11 },
      ingredients: [{ name: "Chicken", amount: "200 g", pantryStaple: false }],
      steps: ["Cook the chicken.", "Serve with rice."],
    }).ingredients[0].amount).toBe("200 g");
  });

  it("validates and estimates nutrition from manual meal ingredients and amounts", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test");
    const nutrition = { calories: 425, proteinG: 28, carbsG: 45, fatG: 12 };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(nutrition) }] } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(mealNutritionRequestSchema.safeParse({
      name: "Chicken rice bowl",
      ingredients: [{ name: "Chicken", amount: "200 g" }, { name: "Rice", amount: "1 cup cooked" }],
    }).success).toBe(true);
    await expect(estimateMealNutrition("Chicken rice bowl", [
      { name: "Chicken", amount: "200 g" },
      { name: "Rice", amount: "1 cup cooked" },
    ])).resolves.toEqual({ nutrition, isFallback: false });
    expect(JSON.stringify(fetchMock.mock.calls[0])).toContain("1 cup cooked");
    expect(JSON.stringify(fetchMock.mock.calls[0])).toContain("per serving");
  });

  it("uses a clearly marked ingredient-based calorie estimate when both AI providers fail", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test");
    vi.stubEnv("GROQ_API_KEY", "groq-test");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 })));
    const loggerError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(estimateMealNutrition("Chicken rice bowl", [
      { name: "Chicken", amount: "200 g" },
      { name: "Rice", amount: "1 cup cooked" },
    ])).resolves.toEqual({
      nutrition: { calories: 672, proteinG: 47, carbsG: 69, fatG: 18 },
      isFallback: true,
    });
    expect(loggerError).toHaveBeenCalledOnce();
    loggerError.mockRestore();
  });

  it("generates meal ideas from the supplied ingredients", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test");
    vi.stubEnv("GROQ_API_KEY", "groq-test");
    const suggestions = Array.from({ length: 5 }, (_, index) => ({
      title: `Meal ${index + 1}`,
      description: "Made with chicken and rice.",
      cookTimeMinutes: 20,
      servings: 2,
      nutrition: { calories: 400, proteinG: 30, carbsG: 45, fatG: 10 },
    }));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ suggestions }) }] } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(suggestRecipes(["chicken", "rice"])).resolves.toEqual({ suggestions, isFallback: false });
    expect(suggestions).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("gemini-3.5-flash-lite");
    expect(JSON.stringify(fetchMock.mock.calls[0])).toContain("chicken");
  });

  it("falls back to Groq when Gemini is unavailable", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test");
    vi.stubEnv("GROQ_API_KEY", "groq-test");
    const suggestions = Array.from({ length: 5 }, (_, index) => ({
      title: `Fallback meal ${index + 1}`,
      description: "Made with chicken and rice.",
      cookTimeMinutes: 20,
      servings: 2,
      nutrition: { calories: 400, proteinG: 30, carbsG: 45, fatG: 10 },
    }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("Model not found", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ suggestions }) } }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(suggestRecipes(["chicken", "rice"])).resolves.toEqual({ suggestions, isFallback: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(JSON.stringify(fetchMock.mock.calls[1])).toContain("openai/gpt-oss-120b");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      reasoning_effort: "low",
      max_completion_tokens: 3000,
    });
  });

  it("returns ingredient-based meal ideas if both AI providers fail", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test");
    vi.stubEnv("GROQ_API_KEY", "groq-test");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 })));

    const result = await suggestRecipes(["chicken", "rice"]);
    expect(result.isFallback).toBe(true);
    expect(result.suggestions).toHaveLength(5);
    expect(result.suggestions[0].description).toContain("chicken, rice");
    expect(result.suggestions.every((suggestion) => suggestion.nutrition.calories > 0)).toBe(true);
  });

  it("returns a basic recipe if both AI providers fail", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test");
    vi.stubEnv("GROQ_API_KEY", "groq-test");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 })));
    const suggestion = {
      title: "Chicken and rice bowl",
      description: "A simple meal.",
      cookTimeMinutes: 20,
      servings: 1,
      nutrition: { calories: 400, proteinG: 30, carbsG: 45, fatG: 10 },
    };

    const result = await generateRecipe(["chicken", "rice"], suggestion);
    expect(result.isFallback).toBe(true);
    expect(result.recipe.ingredients.map((ingredient) => ingredient.name)).toEqual(["chicken", "rice"]);
    expect(result.recipe.steps).toHaveLength(3);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
