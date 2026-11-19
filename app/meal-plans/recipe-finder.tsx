"use client";

import { useRef, useState } from "react";
import { IconSearch } from "@/components/icons";
import { isKnownIngredient, suggestIngredientCorrection, suggestIngredients, type Recipe, type RecipeSuggestion } from "@/lib/recipes";

const starterIngredients = ["chicken", "tomato", "rice", "eggs"];

type MealRequestPayload = {
  suggestions?: RecipeSuggestion[];
  recipe?: Recipe;
  isFallback?: boolean;
  error?: {
    message?: string;
    fields?: Record<string, unknown>;
  };
};

function Nutrition({ nutrition }: { nutrition: Recipe["nutrition"] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        ["Calories", `${Math.round(nutrition.calories)} kcal`],
        ["Protein", `${Math.round(nutrition.proteinG)} g`],
        ["Carbs", `${Math.round(nutrition.carbsG)} g`],
        ["Fat", `${Math.round(nutrition.fatG)} g`],
      ].map(([label, value]) => (
        <div className="rounded-xl bg-[var(--surface-muted)] p-3" key={label}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
          <p className="mt-1 text-sm font-bold tabular-nums text-[var(--foreground)]">{value}</p>
        </div>
      ))}
    </div>
  );
}

function suggestionKey(suggestion: RecipeSuggestion) {
  return [
    suggestion.title,
    suggestion.description,
    suggestion.cookTimeMinutes,
    suggestion.servings,
    suggestion.nutrition.calories,
  ].join("|");
}

export default function RecipeFinder() {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingredientInput, setIngredientInput] = useState("");
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<RecipeSuggestion | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const generationRequestId = useRef(0);
  const suggestionRequestId = useRef(0);
  const currentIngredient = ingredientInput.split(",").at(-1) ?? "";
  const ingredientSuggestions = suggestIngredients(currentIngredient);
  const ingredientEntries = ingredientInput.split(",").map((value, index) => ({
    index,
    typed: value.trim(),
    suggested: suggestIngredientCorrection(value),
  })).filter((entry) => entry.typed);
  const spellingSuggestions = ingredientEntries.filter((entry) => entry.suggested !== null);
  const unrecognizedIngredients = ingredientEntries.filter((entry) => !entry.suggested && !isKnownIngredient(entry.typed));

  function addIngredient(value: string) {
    const additions = value.split(",").map((item) => item.trim()).filter(Boolean);
    if (!additions.length) return;
    const misspelled = additions.find((addition) => suggestIngredientCorrection(addition) !== null);
    if (misspelled) {
      setError(`Correct the spelling of "${misspelled}" using the suggestion below before adding it.`);
      return;
    }
    const unrecognized = additions.find((addition) => !isKnownIngredient(addition));
    if (unrecognized) {
      setError(`"${unrecognized}" isn't in the ingredient list. Enter a food ingredient to continue.`);
      return;
    }
    const next = [...ingredients];
    for (const addition of additions) {
      if (addition.length > 100) {
        setError("Ingredient names must be 100 characters or fewer.");
        return;
      }
      if (!next.some((item) => item.toLowerCase() === addition.toLowerCase())) next.push(addition);
    }
    if (next.length > 20) {
      setError("Add up to 20 ingredients.");
      return;
    }
    generationRequestId.current += 1;
    suggestionRequestId.current += 1;
    setIsGenerating(false);
    setIsSuggesting(false);
    setIngredients(next);
    setIngredientInput("");
    setSuggestions([]);
    setSelectedSuggestion(null);
    setSelectedRecipe(null);
    setError(null);
    setStatus(null);
  }

  function applySpellingSuggestion(index: number, corrected: string) {
    const values = ingredientInput.split(",");
    values[index] = corrected;
    addIngredient(values.join(", "));
  }

  function submitIngredientSearch() {
    const selectedSuggestion = suggestIngredientCorrection(currentIngredient) ?? (
      !ingredientInput.includes(",")
        ? ingredientSuggestions[0]
        : undefined
    );
    addIngredient(selectedSuggestion ?? ingredientInput);
  }

  async function requestJson(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload: MealRequestPayload = await response.json();
    if (!response.ok) {
      const message = payload.error?.message ?? "Something went wrong. Please try again.";
      const details = Object.entries(payload.error?.fields ?? {}).flatMap(([field, messages]) =>
        Array.isArray(messages)
          ? messages.filter((detail): detail is string => typeof detail === "string").map((detail) => `${field}: ${detail}`)
          : [],
      );
      throw new Error(details.length > 0 ? `${message} ${details.join(" ")}` : message);
    }
    return payload;
  }

  async function findMeals() {
    generationRequestId.current += 1;
    const requestId = ++suggestionRequestId.current;
    setError(null);
    setStatus(null);
    setSelectedSuggestion(null);
    setSelectedRecipe(null);
    setSuggestions([]);
    setIsSuggesting(true);
    try {
      const payload = await requestJson("/api/meal-plans/suggest", { ingredients });
      if (requestId === suggestionRequestId.current) {
        setSuggestions(payload.suggestions ?? []);
        if (payload.isFallback) {
          setStatus("AI is temporarily unavailable. Showing basic meal ideas with rough nutrition estimates instead.");
        }
      }
    } catch (requestError) {
      if (requestId === suggestionRequestId.current) {
        setError(requestError instanceof Error ? requestError.message : "Unable to find meal ideas.");
      }
    } finally {
      if (requestId === suggestionRequestId.current) setIsSuggesting(false);
    }
  }

  async function chooseMeal(suggestion: RecipeSuggestion) {
    const requestId = ++generationRequestId.current;
    setError(null);
    setStatus(null);
    setSelectedSuggestion(suggestion);
    setSelectedRecipe(null);
    setIsGenerating(true);
    try {
      const payload = await requestJson("/api/meal-plans/generate-recipe", { ingredients, suggestion });
      if (requestId === generationRequestId.current) {
        setSelectedRecipe(payload.recipe ?? null);
        if (payload.isFallback) {
          setStatus("AI is temporarily unavailable. Showing a basic preparation guide with rough nutrition estimates.");
        }
      }
    } catch (requestError) {
      if (requestId === generationRequestId.current) {
        setError(requestError instanceof Error ? requestError.message : "Unable to generate this recipe.");
      }
    } finally {
      if (requestId === generationRequestId.current) setIsGenerating(false);
    }
  }

  async function saveMeal() {
    if (!selectedRecipe || !selectedSuggestion) return;
    const savedTitle = selectedRecipe.title;
    const savedSuggestion = selectedSuggestion;
    setError(null);
    setStatus(null);
    setIsSaving(true);
    try {
      await requestJson("/api/meal-plans", { visibility: "private", recipe: selectedRecipe });
      setSuggestions((current) => current.filter((suggestion) => suggestion !== savedSuggestion));
      setSelectedSuggestion(null);
      setSelectedRecipe(null);
      setStatus(`Saved ${savedTitle} to My Plans.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save this meal.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs sm:p-7">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--leaf)]">Start with what you have</p>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">What can you cook today?</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            Add ingredients from your kitchen and get meal ideas with nutrition estimates and cooking time.
          </p>
        </div>

        <form
          className="mt-5 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            submitIngredientSearch();
          }}
        >
          <div className="relative min-w-0 flex-1">
            <label className="sr-only" htmlFor="available-ingredients">Available ingredients</label>
            <input
              id="available-ingredients"
              className="h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 pr-12 text-sm outline-none focus:border-[var(--leaf)]"
              placeholder="Try chicken, tomatoes, rice..."
              value={ingredientInput}
              onChange={(event) => {
                setIngredientInput(event.target.value);
                setError(null);
              }}
              autoComplete="off"
            />
            <button
              aria-label="Add ingredient"
              className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-lg text-[var(--leaf-ink)] hover:bg-[var(--leaf-light)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!ingredientInput.trim() || spellingSuggestions.length > 0 || unrecognizedIngredients.length > 0}
              type="submit"
            >
              <IconSearch aria-hidden="true" className="size-5" />
            </button>
            {ingredientSuggestions.length > 0 && !ingredientInput.includes(",") && (
              <ul className="absolute inset-x-0 z-10 mt-1 max-h-52 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-lg" aria-label="Ingredient suggestions">
                {ingredientSuggestions.slice(0, 6).map((ingredient) => (
                  <li key={ingredient}>
                    <button
                      className="w-full rounded-lg px-3 py-2 text-left text-sm capitalize hover:bg-[var(--surface-muted)]"
                      onClick={() => addIngredient(ingredient)}
                      type="button"
                    >
                      {ingredient}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {spellingSuggestions.map(({ index, typed, suggested }) => (
              <p className="mt-2 text-xs text-[var(--ink-muted)]" key={`${index}-${typed}`} role="status">
                Did you mean{" "}
                <button
                  className="font-bold text-[var(--leaf)] underline underline-offset-2"
                  onClick={() => suggested && applySpellingSuggestion(index, suggested)}
                  type="button"
                >
                  {suggested}
                </button>
                {" "}instead of &quot;{typed}&quot;?
              </p>
            ))}
            {unrecognizedIngredients.map(({ index, typed }) => (
              <p className="mt-2 text-xs text-[var(--coral)]" key={`unrecognized-${index}-${typed}`} role="status">
                &quot;{typed}&quot; isn&apos;t recognized as an ingredient. Try a food such as chicken, rice, or tomato.
              </p>
            ))}
          </div>
        </form>

        <div className="mt-4" aria-label="Selected ingredients">
          {ingredients.length > 0 && <p className="mb-2 text-xs font-bold text-[var(--ink-muted)]">Selected ingredients</p>}
          <div className="flex flex-wrap gap-2">
            {ingredients.map((ingredient) => (
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--leaf-light)] px-3 py-1.5 text-xs font-semibold text-[var(--leaf-ink)]" key={ingredient}>
                {ingredient}
                <button
                  aria-label={`Remove ${ingredient}`}
                  className="rounded-full text-[var(--leaf-ink)] hover:text-[var(--coral)]"
                  onClick={() => {
                    generationRequestId.current += 1;
                    suggestionRequestId.current += 1;
                    setIsGenerating(false);
                    setIsSuggesting(false);
                    setIngredients((current) => current.filter((item) => item !== ingredient));
                    setSuggestions([]);
                    setSelectedSuggestion(null);
                    setSelectedRecipe(null);
                  }}
                  type="button"
                >
                  ×
                </button>
              </span>
            ))}
            {ingredients.length === 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)]">
                <span>Quick add:</span>
                {starterIngredients.map((ingredient) => (
                  <button className="rounded-full border border-[var(--line)] px-3 py-1.5 font-semibold hover:border-[var(--leaf)]" key={ingredient} onClick={() => addIngredient(ingredient)} type="button">
                    {ingredient}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          className="mt-5 h-12 w-full rounded-xl bg-[var(--leaf)] px-5 text-sm font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={ingredients.length === 0 || isSuggesting || isGenerating}
          onClick={() => void findMeals()}
          type="button"
        >
          {isSuggesting ? "Finding meal ideas..." : isGenerating ? "Generating recipe..." : "Find meals"}
        </button>
      </section>

      {(error || status) && (
        <p className={`rounded-xl border p-4 text-sm font-semibold ${error ? "border-[var(--coral)]/30 bg-[var(--coral)]/10 text-[var(--coral)]" : "border-[var(--leaf)]/30 bg-[var(--leaf-light)] text-[var(--leaf-ink)]"}`} role={error ? "alert" : "status"}>
          {error ?? status}
        </p>
      )}

      {suggestions.length > 0 && (
        <section className="space-y-4" aria-labelledby="meal-suggestions-title">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]" id="meal-suggestions-title">Meals you can make</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">Choose one to get the ingredient amounts and step-by-step instructions.</p>
          </div>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {suggestions.map((suggestion) => {
              const isSelected = selectedSuggestion === suggestion;
              return (
                <div className="mb-4 inline-block w-full break-inside-avoid" key={suggestionKey(suggestion)}>
                  <article
                    className={`rounded-2xl border bg-[var(--surface)] p-5 shadow-xs ${isSelected ? "border-[var(--leaf)] ring-1 ring-[var(--leaf)]" : "border-[var(--line)]"}`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="line-clamp-1 text-base font-bold text-[var(--foreground)]">{suggestion.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--ink-muted)]">{suggestion.description}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--ink-muted)]">
                          {suggestion.cookTimeMinutes} min
                        </span>
                      </div>
                      <div className="mt-4">
                        <Nutrition nutrition={suggestion.nutrition} />
                      </div>
                      <p className="mt-2 min-h-4 text-[11px] text-[var(--ink-muted)]">
                        Estimated per serving · {suggestion.servings} servings
                      </p>
                      <div className="mt-6">
                        <button
                          className="h-10 w-full rounded-xl border border-[var(--leaf)] text-sm font-bold text-[var(--leaf-ink)] hover:bg-[var(--leaf-light)] disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isSelected && (isGenerating || Boolean(selectedRecipe))}
                          onClick={() => void chooseMeal(suggestion)}
                          type="button"
                        >
                          {isGenerating && isSelected
                            ? "Generating recipe..."
                            : isSelected && selectedRecipe
                              ? "Recipe ready"
                              : "Choose this meal"}
                        </button>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="mt-5 border-t border-[var(--line)] pt-5">
                        {!selectedRecipe ? (
                          <div>
                            <p className="text-sm font-semibold text-[var(--leaf-ink)]" role="status">
                              {isGenerating ? "Generating this recipe..." : "Recipe generation did not finish."}
                            </p>
                            {!isGenerating && (
                              <button
                                className="mt-3 h-10 rounded-xl bg-[var(--leaf)] px-4 text-sm font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)]"
                                onClick={() => void chooseMeal(suggestion)}
                                type="button"
                              >
                                Try again
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h4 className="text-lg font-bold text-[var(--foreground)]">{selectedRecipe.title}</h4>
                                <p className="mt-1 text-sm text-[var(--ink-muted)]">{selectedRecipe.description}</p>
                              </div>
                              <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-muted)]">
                                {selectedRecipe.cookTimeMinutes} min · {selectedRecipe.servings} servings
                              </span>
                            </div>
                            <div className="mt-4">
                              <Nutrition nutrition={selectedRecipe.nutrition} />
                              <p className="mt-2 text-[11px] text-[var(--ink-muted)]">Estimated nutrition per serving</p>
                            </div>
                            <div className="mt-6 grid gap-6 md:grid-cols-2">
                              <div>
                                <h4 className="text-sm font-bold text-[var(--foreground)]">Ingredients</h4>
                                <ul className="mt-3 space-y-2">
                                  {selectedRecipe.ingredients.map((ingredient, ingredientIndex) => (
                                    <li className="flex justify-between gap-3 border-b border-[var(--line)] pb-2 text-sm" key={`${ingredient.name}-${ingredientIndex}`}>
                                      <span className="text-[var(--foreground)]">
                                        {ingredient.name}
                                        {ingredient.pantryStaple ? <span className="ml-1 text-xs text-[var(--ink-muted)]">(pantry staple)</span> : null}
                                      </span>
                                      <span className="shrink-0 font-semibold text-[var(--ink-muted)]">{ingredient.amount}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-[var(--foreground)]">Cooking steps</h4>
                                <ol className="mt-3 space-y-3">
                                  {selectedRecipe.steps.map((step, stepIndex) => (
                                    <li className="flex gap-3 text-sm leading-6 text-[var(--foreground)]" key={`${step}-${stepIndex}`}>
                                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--leaf-light)] text-xs font-bold text-[var(--leaf-ink)]">{stepIndex + 1}</span>
                                      {step}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            </div>
                            <button
                              className="mt-6 h-11 w-full rounded-xl bg-[var(--leaf)] px-5 text-sm font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:opacity-50 sm:w-auto"
                              disabled={isSaving}
                              onClick={() => void saveMeal()}
                              type="button"
                            >
                              {isSaving ? "Saving..." : "Save in My Plans"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </article>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
