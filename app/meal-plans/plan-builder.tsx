"use client";

import { useEffect, useRef, useState } from "react";
import { prepareMealPhotoFile, removeUploadedMealPlanPhoto, uploadMealPlanPhoto } from "@/lib/client-image";
import type { Recipe, RecipeNutrition } from "@/lib/recipes";
import { IconX } from "@/components/icons";

type IngredientInput = { name: string; amount: string };

function isRecipeNutrition(value: unknown): value is RecipeNutrition {
  if (typeof value !== "object" || value === null) return false;
  const nutrition = value as Record<string, unknown>;
  return (
    Number.isFinite(nutrition.calories) &&
    Number.isFinite(nutrition.proteinG) &&
    Number.isFinite(nutrition.carbsG) &&
    Number.isFinite(nutrition.fatG) &&
    Number(nutrition.calories) >= 0 &&
    Number(nutrition.calories) <= 5000 &&
    Number(nutrition.proteinG) >= 0 &&
    Number(nutrition.proteinG) <= 500 &&
    Number(nutrition.carbsG) >= 0 &&
    Number(nutrition.carbsG) <= 1000 &&
    Number(nutrition.fatG) >= 0 &&
    Number(nutrition.fatG) <= 500
  );
}

export default function PlanBuilder({
  onPlanCreated,
}: {
  onPlanCreated?: (visibility: "public" | "private", trackerMessage: string, trackerError: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [servingsInput, setServingsInput] = useState("1");
  const [cookTimeInput, setCookTimeInput] = useState("20");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [ingredients, setIngredients] = useState<IngredientInput[]>([{ name: "", amount: "" }]);
  const [steps, setSteps] = useState([""]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoPreviewUrl = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl.current) URL.revokeObjectURL(photoPreviewUrl.current);
    };
  }, []);

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    try {
      const prepared = await prepareMealPhotoFile(file);
      if (photoPreviewUrl.current) URL.revokeObjectURL(photoPreviewUrl.current);
      photoPreviewUrl.current = URL.createObjectURL(prepared);
      setPhotoPreview(photoPreviewUrl.current);
      setError(null);
      setPhoto(prepared);
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "Unable to read photo.");
    }
  }

  function removePhoto() {
    if (photoPreviewUrl.current) URL.revokeObjectURL(photoPreviewUrl.current);
    photoPreviewUrl.current = null;
    setPhotoPreview(null);
    setPhoto(null);
  }

  function updateIngredient(index: number, field: keyof IngredientInput, value: string) {
    setIngredients((current) => {
      const updated = current.map((ingredient, ingredientIndex) =>
        ingredientIndex === index ? { ...ingredient, [field]: value } : ingredient,
      );
      if (index === current.length - 1 && value.trim() && current.length < 30) {
        updated.push({ name: "", amount: "" });
      }
      return updated;
    });
  }

  function removeIngredient(index: number) {
    setIngredients((current) => {
      const remaining = current.filter((_, ingredientIndex) => ingredientIndex !== index);
      if (remaining.length === 0 || remaining[remaining.length - 1].name || remaining[remaining.length - 1].amount) {
        remaining.push({ name: "", amount: "" });
      }
      return remaining;
    });
  }

  function updateStep(index: number, value: string) {
    setSteps((current) => {
      const updated = current.map((step, stepIndex) => (stepIndex === index ? value : step));
      if (index === current.length - 1 && value.trim() && current.length < 20) {
        updated.push("");
      }
      return updated;
    });
  }

  function removeStep(index: number) {
    setSteps((current) => {
      const remaining = current.filter((_, stepIndex) => stepIndex !== index);
      if (remaining.length === 0 || remaining[remaining.length - 1].trim()) {
        remaining.push("");
      }
      return remaining;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    void publishPlan(visibility);
  }

  async function publishPlan(targetVisibility: "public" | "private") {
    const recipeIngredients = ingredients
      .map((ingredient) => ({ name: ingredient.name.trim(), amount: ingredient.amount.trim(), pantryStaple: false }))
      .filter((ingredient) => ingredient.name && ingredient.amount);
    const recipeSteps = steps.map((step) => step.trim()).filter(Boolean);
    const servings = Math.max(1, Math.min(12, Math.round(Number(servingsInput)) || 1));
    const cookTimeMinutes = Math.max(1, Math.min(240, Math.round(Number(cookTimeInput)) || 20));

    if (!name.trim()) {
      setError("Enter a meal name.");
      return;
    }
    if (ingredients.some((ingredient) => Boolean(ingredient.name.trim()) !== Boolean(ingredient.amount.trim()))) {
      setError("Enter both the ingredient and amount, or clear the row.");
      return;
    }
    if (recipeIngredients.length === 0) {
      setError("Add at least one ingredient with its amount.");
      return;
    }
    if (recipeSteps.length === 0) {
      setError("Add at least one cooking step.");
      return;
    }
    if (recipeIngredients.length > 30 || recipeSteps.length > 20) {
      setError("Use up to 30 ingredients and 20 cooking steps.");
      return;
    }

    setIsSaving(true);
    let uploadedPhotoPath: string | null = null;
    try {
      const estimateResponse = await fetch("/api/meal-plans/estimate-nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), ingredients: recipeIngredients }),
      });
      const estimatePayload = await estimateResponse.json();
      if (!estimateResponse.ok) {
        throw new Error(estimatePayload.error?.message ?? "Unable to estimate meal calories.");
      }
      if (!isRecipeNutrition(estimatePayload.nutrition)) {
        throw new Error("Unable to estimate meal calories. Please check the ingredients and try again.");
      }
      const nutrition = estimatePayload.nutrition;
      const isNutritionFallback = estimatePayload.isFallback === true;

      let imageUrl: string | undefined;
      if (photo) {
        const uploaded = await uploadMealPlanPhoto(photo);
        uploadedPhotoPath = uploaded.path;
        imageUrl = uploaded.imageUrl;
      }

      const recipe: Recipe = {
        title: name.trim(),
        description: "Manually added recipe.",
        cookTimeMinutes,
        servings,
        nutrition,
        ingredients: recipeIngredients,
        steps: recipeSteps,
        manual: true,
        nutritionEstimate: isNutritionFallback ? "ingredient-based" : "ai",
        ...(imageUrl ? { imageUrl } : {}),
      };
      const response = await fetch("/api/meal-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: targetVisibility, recipe }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = payload.error?.message ?? "Unable to save meal plan.";
        if (uploadedPhotoPath) {
          await removeUploadedMealPlanPhoto(uploadedPhotoPath);
          uploadedPhotoPath = null;
        }
        setError(message);
        return;
      }

      uploadedPhotoPath = null;
      const destination = targetVisibility === "public" ? "Public Plans" : "My Plans";
      const trackerMessage = isNutritionFallback
        ? `Saved "${recipe.title}" to ${destination} with an approximate ingredient-based nutrition estimate.`
        : `Saved "${recipe.title}" to ${destination} (${Math.round(nutrition.calories)} kcal/serving).`;

      setName("");
      setServingsInput("1");
      setCookTimeInput("20");
      setVisibility("private");
      setIngredients([{ name: "", amount: "" }]);
      setSteps([""]);
      removePhoto();
      onPlanCreated?.(targetVisibility, trackerMessage, false);
    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : "Unable to save meal plan.";
      if (uploadedPhotoPath) {
        await removeUploadedMealPlanPhoto(uploadedPhotoPath);
      }
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && (
        <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] p-4 text-xs font-bold text-[var(--coral)]" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]" htmlFor="builder-name">
            Meal name
          </label>
          <input
            id="builder-name"
            className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 text-sm font-semibold outline-none focus:border-[var(--leaf)]"
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Grandma's vegetable soup"
            required
            value={name}
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]" htmlFor="builder-servings">
            Servings
          </label>
          <input
            id="builder-servings"
            type="number"
            inputMode="numeric"
            min="1"
            max="12"
            step="1"
            className="tabular-nums mt-1.5 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 text-sm font-bold outline-none focus:border-[var(--leaf)]"
            value={servingsInput}
            onChange={(event) => setServingsInput(event.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]" htmlFor="builder-cook-time">
            Cook time (min)
          </label>
          <input
            id="builder-cook-time"
            type="number"
            inputMode="numeric"
            min="1"
            max="240"
            step="1"
            className="tabular-nums mt-1.5 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 text-sm font-bold outline-none focus:border-[var(--leaf)]"
            value={cookTimeInput}
            onChange={(event) => setCookTimeInput(event.target.value)}
          />
        </div>
      </div>

      <section aria-labelledby="manual-ingredients-heading" className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--foreground)]" id="manual-ingredients-heading">Ingredients</h3>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">Enter an ingredient and amount; a new row appears as you type.</p>
        </div>
        {ingredients.map((ingredient, index) => (
          <div className="flex items-center gap-2" key={index}>
            <label className="sr-only" htmlFor={`ingredient-name-${index}`}>Ingredient {index + 1}</label>
            <input
              className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--leaf)]"
              id={`ingredient-name-${index}`}
              maxLength={200}
              onChange={(event) => updateIngredient(index, "name", event.target.value)}
              placeholder="Ingredient"
              value={ingredient.name}
            />
            <label className="sr-only" htmlFor={`ingredient-amount-${index}`}>Amount for ingredient {index + 1}</label>
            <input
              className="h-11 w-28 rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--leaf)] sm:w-36"
              id={`ingredient-amount-${index}`}
              maxLength={80}
              onChange={(event) => updateIngredient(index, "amount", event.target.value)}
              placeholder="Amount"
              value={ingredient.amount}
            />
            <button
              aria-label={`Remove ingredient ${index + 1}`}
              className="grid size-11 shrink-0 place-items-center rounded-xl text-[var(--coral)] hover:bg-[var(--coral-soft)] disabled:opacity-40"
              disabled={ingredients.length === 1 && !ingredient.name && !ingredient.amount}
              onClick={() => removeIngredient(index)}
              type="button"
            >
              <IconX className="size-4" />
            </button>
          </div>
        ))}
      </section>

      <section aria-labelledby="manual-steps-heading" className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--foreground)]" id="manual-steps-heading">How to cook it</h3>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">Write each cooking step in order; a new row appears as you type.</p>
        </div>
        {steps.map((step, index) => (
          <div className="flex items-start gap-2" key={index}>
            <label className="sr-only" htmlFor={`cooking-step-${index}`}>Cooking step {index + 1}</label>
            <span aria-hidden="true" className="pt-3 text-sm font-bold text-[var(--ink-muted)]">{index + 1}.</span>
            <textarea
              className="min-h-16 min-w-0 flex-1 resize-y rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--leaf)]"
              id={`cooking-step-${index}`}
              maxLength={800}
              onChange={(event) => updateStep(index, event.target.value)}
              placeholder="Describe this cooking step"
              value={step}
            />
            <button
              aria-label={`Remove cooking step ${index + 1}`}
              className="grid size-11 shrink-0 place-items-center rounded-xl text-[var(--coral)] hover:bg-[var(--coral-soft)] disabled:opacity-40"
              disabled={steps.length === 1 && !step}
              onClick={() => removeStep(index)}
              type="button"
            >
              <IconX className="size-4" />
            </button>
          </div>
        ))}
      </section>

      <section aria-labelledby="manual-photo-heading" className="space-y-3">
        <h3 className="text-sm font-bold text-[var(--foreground)]" id="manual-photo-heading">
          Add a photo <span className="font-normal text-[var(--ink-muted)]">(optional)</span>
        </h3>
        {photoPreview ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Meal preview" className="h-48 w-full rounded-2xl border border-[var(--line)] object-cover" src={photoPreview} />
            <button
              className="min-h-11 px-2 text-xs font-bold text-[var(--coral)] hover:underline"
              onClick={removePhoto}
              type="button"
            >
              Remove photo
            </button>
          </div>
        ) : (
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border-control)] bg-[var(--surface-muted)] p-6 text-center focus-within:ring-2 focus-within:ring-[var(--leaf)] hover:border-[var(--leaf)]">
            <span className="text-sm font-bold text-[var(--foreground)]">Choose a meal photo</span>
            <span className="mt-1 text-xs text-[var(--ink-muted)]">JPG, PNG, or WebP (auto-compressed)</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => void choosePhoto(event.target.files?.[0])}
              type="file"
            />
          </label>
        )}
      </section>

      <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-bold uppercase text-[var(--ink-muted)]">Visibility</p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Recipe visibility">
          <button
            type="button"
            aria-pressed={visibility === "private"}
            onClick={() => setVisibility("private")}
            className={`active-press min-h-11 rounded-xl px-3 text-xs font-bold transition-colors ${
              visibility === "private"
                ? "bg-[var(--leaf)] text-[var(--on-leaf)]"
                : "border border-[var(--border-control)] bg-[var(--surface)] text-[var(--foreground)]"
            }`}
          >
            Private (My Plans)
          </button>
          <button
            type="button"
            aria-pressed={visibility === "public"}
            onClick={() => setVisibility("public")}
            className={`active-press min-h-11 rounded-xl px-3 text-xs font-bold transition-colors ${
              visibility === "public"
                ? "bg-[var(--leaf)] text-[var(--on-leaf)]"
                : "border border-[var(--border-control)] bg-[var(--surface)] text-[var(--foreground)]"
            }`}
          >
            Share in Public Plans
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] p-4 text-xs font-bold text-[var(--coral)]" role="alert">
          {error}
        </p>
      )}

      <button
        className="active-press h-12 w-full rounded-xl bg-[var(--leaf)] px-4 text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSaving}
        type="submit"
      >
        {isSaving
          ? "Estimating & saving..."
          : visibility === "public"
            ? "Publish to Public Plans"
            : "Save to My Plans"}
      </button>
    </form>
  );
}
