"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Recipe, RecipeNutrition } from "@/lib/recipes";

type IngredientInput = { name: string; amount: string };
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const allowedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];

function isRecipeNutrition(value: unknown): value is RecipeNutrition {
  if (typeof value !== "object" || value === null) return false;
  const nutrition = value as Record<string, unknown>;
  return Number.isFinite(nutrition.calories)
    && Number.isFinite(nutrition.proteinG)
    && Number.isFinite(nutrition.carbsG)
    && Number.isFinite(nutrition.fatG)
    && Number(nutrition.calories) >= 0
    && Number(nutrition.calories) <= 5000
    && Number(nutrition.proteinG) >= 0
    && Number(nutrition.proteinG) <= 500
    && Number(nutrition.carbsG) >= 0
    && Number(nutrition.carbsG) <= 1000
    && Number(nutrition.fatG) >= 0
    && Number(nutrition.fatG) <= 500;
}

export default function PlanBuilder({
  onPlanCreated,
}: {
  onPlanCreated?: (visibility: "public" | "private", trackerMessage: string, trackerError: boolean) => void;
}) {
  const [name, setName] = useState("");
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

  function choosePhoto(file: File | undefined) {
    if (!file) return;
    if (!allowedPhotoTypes.includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP photo.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Photo size should be less than 3MB.");
      return;
    }
    if (photoPreviewUrl.current) URL.revokeObjectURL(photoPreviewUrl.current);
    photoPreviewUrl.current = URL.createObjectURL(file);
    setPhotoPreview(photoPreviewUrl.current);
    setError(null);
    setPhoto(file);
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
        ingredientIndex === index ? { ...ingredient, [field]: value } : ingredient
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
      const updated = current.map((step, stepIndex) => stepIndex === index ? value : step);
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
    const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
    if (!(submitter instanceof HTMLButtonElement) || (submitter.value !== "public" && submitter.value !== "private")) {
      setError("Choose whether to post this meal publicly or save it to My Plans.");
      return;
    }
    void publishPlan(submitter.value);
  }

  async function publishPlan(visibility: "public" | "private") {
    const recipeIngredients = ingredients
      .map((ingredient) => ({ name: ingredient.name.trim(), amount: ingredient.amount.trim(), pantryStaple: false }))
      .filter((ingredient) => ingredient.name && ingredient.amount);
    const recipeSteps = steps.map((step) => step.trim()).filter(Boolean);

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
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw new Error(userError.message);
        if (!user) throw new Error("Sign in again before uploading a photo.");

        const extension = photo.type === "image/jpeg" ? "jpg" : photo.type === "image/png" ? "png" : "webp";
        const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("meal-plan-photos")
          .upload(path, photo, { contentType: photo.type, upsert: false });
        if (uploadError) throw new Error(`Unable to upload photo: ${uploadError.message}`);
        uploadedPhotoPath = path;
        imageUrl = supabase.storage.from("meal-plan-photos").getPublicUrl(path).data.publicUrl;
      }

      const recipe: Recipe = {
        title: name.trim(),
        description: "Manually added recipe.",
        cookTimeMinutes: 1,
        servings: 1,
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
        body: JSON.stringify({ visibility, recipe }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = payload.error?.message ?? "Unable to publish meal plan.";
        if (uploadedPhotoPath) {
          const { error: cleanupError } = await createClient().storage
            .from("meal-plan-photos")
            .remove([uploadedPhotoPath]);
          uploadedPhotoPath = null;
          if (cleanupError) throw new Error(`${message} The uploaded photo could not be removed: ${cleanupError.message}`);
        }
        setError(message);
        return;
      }

      uploadedPhotoPath = null;
      const trackerMessage = isNutritionFallback
        ? `Saved "${recipe.title}" with an approximate ingredient-based nutrition estimate. Use Log meal in My Plans when you are ready to add it to today's tracker.`
        : `Saved "${recipe.title}" with an estimated ${Math.round(nutrition.calories)} kcal per serving. Use Log meal in My Plans when you are ready to add it to today's tracker.`;
      const trackerError = false;

      setName("");
      setIngredients([{ name: "", amount: "" }]);
      setSteps([""]);
      removePhoto();
      onPlanCreated?.(visibility, trackerMessage, trackerError);
    } catch (publishError) {
      let message = publishError instanceof Error ? publishError.message : "Unable to publish meal plan.";
      if (uploadedPhotoPath) {
        const { error: cleanupError } = await createClient().storage
          .from("meal-plan-photos")
          .remove([uploadedPhotoPath]);
        if (cleanupError) message = `${message} The uploaded photo could not be removed: ${cleanupError.message}`;
      }
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/10 p-4 text-xs font-bold text-[var(--coral)]" role="alert">{error}</p>}

      <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]">
        Meal name
        <input
          className="mt-1.5 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-semibold outline-none focus:border-[var(--leaf)]"
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Grandma's vegetable soup"
          required
          value={name}
        />
      </label>

      <section aria-labelledby="manual-ingredients-heading" className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--foreground)]" id="manual-ingredients-heading">Ingredients</h3>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">Enter an ingredient and amount; a new row appears as you type.</p>
        </div>
        {ingredients.map((ingredient, index) => (
          <div className="flex items-center gap-2" key={index}>
            <label className="sr-only" htmlFor={`ingredient-name-${index}`}>Ingredient {index + 1}</label>
            <input
              className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--leaf)]"
              id={`ingredient-name-${index}`}
              maxLength={200}
              onChange={(event) => updateIngredient(index, "name", event.target.value)}
              placeholder="Ingredient"
              value={ingredient.name}
            />
            <label className="sr-only" htmlFor={`ingredient-amount-${index}`}>Amount for ingredient {index + 1}</label>
            <input
              className="h-10 w-28 rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--leaf)] sm:w-36"
              id={`ingredient-amount-${index}`}
              maxLength={80}
              onChange={(event) => updateIngredient(index, "amount", event.target.value)}
              placeholder="Amount"
              value={ingredient.amount}
            />
            <button
              aria-label={`Remove ingredient ${index + 1}`}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--coral)] hover:bg-[var(--coral)]/10 disabled:opacity-40"
              disabled={ingredients.length === 1 && !ingredient.name && !ingredient.amount}
              onClick={() => removeIngredient(index)}
              type="button"
            >
              ×
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
            <span aria-hidden="true" className="pt-2.5 text-sm font-bold text-[var(--ink-muted)]">{index + 1}.</span>
            <textarea
              className="min-h-16 min-w-0 flex-1 resize-y rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--leaf)]"
              id={`cooking-step-${index}`}
              maxLength={800}
              onChange={(event) => updateStep(index, event.target.value)}
              placeholder="Describe this cooking step"
              value={step}
            />
            <button
              aria-label={`Remove cooking step ${index + 1}`}
              className="mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-[var(--coral)] hover:bg-[var(--coral)]/10 disabled:opacity-40"
              disabled={steps.length === 1 && !step}
              onClick={() => removeStep(index)}
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </section>

      <section aria-labelledby="manual-photo-heading" className="space-y-3">
        <h3 className="text-sm font-bold text-[var(--foreground)]" id="manual-photo-heading">Add a photo <span className="font-normal text-[var(--ink-muted)]">(optional)</span></h3>
        {photoPreview ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Meal preview" className="h-48 w-full rounded-2xl border border-[var(--line)] object-cover" src={photoPreview} />
            <button className="text-xs font-bold text-[var(--coral)] hover:underline" onClick={removePhoto} type="button">
              Remove photo
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--surface-muted)] p-6 text-center hover:border-[var(--leaf)]">
            <span className="text-sm font-bold text-[var(--foreground)]">Choose a meal photo</span>
            <span className="mt-1 text-xs text-[var(--ink-muted)]">JPG, PNG, or WebP up to 3MB</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => choosePhoto(event.target.files?.[0])}
              type="file"
            />
          </label>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className="active-press h-12 rounded-xl bg-[var(--leaf)] px-4 text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving}
          name="visibility"
          type="submit"
          value="public"
        >
          {isSaving ? "Estimating & posting..." : "Post to Public Plans"}
        </button>
        <button
          className="active-press h-12 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving}
          name="visibility"
          type="submit"
          value="private"
        >
          {isSaving ? "Estimating & saving..." : "Post to My Plans"}
        </button>
      </div>
    </form>
  );
}
