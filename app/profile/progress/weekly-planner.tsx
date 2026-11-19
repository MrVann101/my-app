"use client";

import { useEffect, useRef, useState } from "react";
import { IconSparkles } from "@/components/icons";
import {
  getMealSlotLabel,
  parsePreferenceList,
  weeklyPlanRecordSchema,
  weeklyPlanScheduleSchema,
  weeklyPlanDaySchema,
  weeklyPlanMealSchema,
  type WeeklyPlan,
  type WeeklyPlanDay,
  type WeeklyPlanMeal,
  type WeeklyPlanPreferences,
} from "@/lib/weekly-plan-schemas";

const defaultPreferences: WeeklyPlanPreferences = {
  dailyCalorieTarget: 2000,
  mealsPerDay: 3,
  preferredFoods: [],
  foodRestrictions: [],
};

type PlanDraft = {
  id?: number;
  name: string;
  preferences: WeeklyPlanPreferences;
  days: WeeklyPlanDay[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function responseError(response: Response, fallback: string) {
  const payload: unknown = await response.json().catch(() => null);
  return isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string"
    ? payload.error.message
    : fallback;
}

function caloriesFor(meal: WeeklyPlanMeal) {
  return Math.round(meal.nutrition.calories * meal.servings);
}

export default function WeeklyPlanner() {
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [current, setCurrent] = useState<PlanDraft | null>(null);
  const [userProfileTarget, setUserProfileTarget] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [savingRecipeTitle, setSavingRecipeTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [planToDelete, setPlanToDelete] = useState<WeeklyPlan | null>(null);
  const [planName, setPlanName] = useState("My Weekly Plan");
  const [calorieTarget, setCalorieTarget] = useState(String(defaultPreferences.dailyCalorieTarget));
  const [mealsPerDay, setMealsPerDay] = useState(String(defaultPreferences.mealsPerDay));
  const [preferredFoods, setPreferredFoods] = useState("");
  const [foodRestrictions, setFoodRestrictions] = useState("");
  const deleteDialogRef = useRef<HTMLDivElement>(null);

  const todayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [plansRes, profileRes] = await Promise.all([
          fetch("/api/weekly-plans"),
          fetch("/api/profile").catch(() => null),
        ]);
        if (!plansRes.ok) throw new Error(await responseError(plansRes, "Unable to load saved weekly plans."));
        const payload: unknown = await plansRes.json();
        const savedPlans = weeklyPlanRecordSchema.array().parse(isRecord(payload) ? payload.plans : undefined);

        let profileTarget: number | null = null;
        if (profileRes && profileRes.ok) {
          const profilePayload = await profileRes.json().catch(() => null);
          if (isRecord(profilePayload) && isRecord(profilePayload.profile) && typeof profilePayload.profile.target_calories === "number") {
            profileTarget = profilePayload.profile.target_calories;
          }
        }

        if (!active) return;
        setUserProfileTarget(profileTarget);
        setPlans(savedPlans);
        if (savedPlans[0]) {
          setCurrent(savedPlans[0]);
          setPlanName(savedPlans[0].name);
          setPreferencesForm(savedPlans[0].preferences);
        } else if (profileTarget) {
          setCalorieTarget(String(profileTarget));
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load saved weekly plans.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!planToDelete) return;
    deleteDialogRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPlanToDelete(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [planToDelete]);

  function setPreferencesForm(preferences: WeeklyPlanPreferences) {
    setCalorieTarget(String(preferences.dailyCalorieTarget));
    setMealsPerDay(String(preferences.mealsPerDay));
    setPreferredFoods(preferences.preferredFoods.join(", "));
    setFoodRestrictions(preferences.foodRestrictions.join(", "));
  }

  function readPreferences(): WeeklyPlanPreferences {
    const target = Number(calorieTarget);
    const count = Number(mealsPerDay);
    const preferred = parsePreferenceList(preferredFoods);
    const restrictions = parsePreferenceList(foodRestrictions);
    if (!Number.isInteger(target) || target < 800 || target > 6000) {
      throw new Error("Choose a daily calorie target between 800 and 6,000 kcal.");
    }
    if (!Number.isInteger(count) || count < 2 || count > 6) {
      throw new Error("Choose between 2 and 6 meals per day.");
    }
    if (preferred.length > 12 || restrictions.length > 12) {
      throw new Error("Enter up to 12 preferred foods and 12 food restrictions, separated by commas.");
    }
    return {
      dailyCalorieTarget: target,
      mealsPerDay: count,
      preferredFoods: preferred,
      foodRestrictions: restrictions,
    };
  }

  function startNewPlan() {
    setCurrent(null);
    setPlanName("My Weekly Plan");
    setPreferencesForm(userProfileTarget ? { ...defaultPreferences, dailyCalorieTarget: userProfileTarget } : defaultPreferences);
    setError(null);
    setNotice(null);
    setIsCreating(true);
  }

  async function saveMealAsRecipe(meal: WeeklyPlanMeal) {
    setSavingRecipeTitle(meal.title);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/meal-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: meal.title,
          visibility: "private",
          recipe: {
            title: meal.title,
            description: meal.description,
            servings: meal.servings || 1,
            prepTimeMinutes: 15,
            cookTimeMinutes: 20,
            ingredients: [
              { name: meal.title, amount: 1, unit: "serving" }
            ],
            instructions: [
              "Prepare according to recipe plan.",
              "Serve and enjoy."
            ],
            nutrition: {
              calories: Math.round(meal.nutrition.calories * meal.servings),
              proteinG: Math.round(meal.nutrition.proteinG * meal.servings),
              carbsG: Math.round(meal.nutrition.carbsG * meal.servings),
              fatG: Math.round(meal.nutrition.fatG * meal.servings),
            },
          },
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Unable to save this recipe."));
      setNotice(`Saved "${meal.title}" to your Recipe collection in Meal Plans.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save recipe.");
    } finally {
      setSavingRecipeTitle(null);
    }
  }

  function openPlan(plan: WeeklyPlan) {
    setCurrent(plan);
    setPlanName(plan.name);
    setPreferencesForm(plan.preferences);
    setIsCreating(false);
    setError(null);
    setNotice(null);
  }

  async function generate(action: "week" | "day" | "meal", extra: Record<string, string> = {}) {
    setError(null);
    setNotice(null);
    const key = action === "week" ? "week" : `${action}-${extra.day ?? ""}-${extra.slot ?? ""}`;
    setIsGenerating(key);
    try {
      const preferences = action === "week" ? readPreferences() : current?.preferences;
      if (!preferences) throw new Error("Create or open a plan before regenerating meals.");
      const response = await fetch("/api/weekly-plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, preferences, ...extra }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Unable to generate the weekly plan."));
      const payload: unknown = await response.json();
      if (!isRecord(payload)) throw new Error("The generated plan response was invalid.");

      if (action === "week") {
        const days = weeklyPlanScheduleSchema.parse(payload.days);
        setCurrent({ name: planName.trim() || "My Weekly Plan", preferences, days });
        setIsCreating(false);
        setNotice("Your 7-day plan is ready. Review and customize it, then save it.");
      } else if (action === "day") {
        const regenerated = weeklyPlanDaySchema.parse(payload.day);
        setCurrent((plan) => plan
          ? { ...plan, days: plan.days.map((day) => day.day === regenerated.day ? regenerated : day) }
          : plan);
        setNotice(`${regenerated.day} has been regenerated.`);
      } else {
        const meal = weeklyPlanMealSchema.parse(payload.meal);
        const dayName = extra.day;
        const slot = extra.slot;
        setCurrent((plan) => plan
          ? {
              ...plan,
              days: plan.days.map((day) => {
                if (day.day !== dayName) return day;
                const index = day.meals.findIndex((_, mealIndex) => getMealSlotLabel(day.meals.length, mealIndex) === slot);
                if (index < 0) return day;
                const previous = day.meals[index];
                const meals = [...day.meals];
                meals[index] = { ...meal, servings: previous.servings };
                return { ...day, meals };
              }),
            }
          : plan);
        setNotice("Meal replaced. Save your changes to keep this version.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to generate the weekly plan.");
    } finally {
      setIsGenerating(null);
    }
  }

  function updateServings(dayName: string, mealIndex: number, servings: number) {
    if (!Number.isFinite(servings) || servings < 0.25 || servings > 12) return;
    setCurrent((plan) => plan
      ? {
          ...plan,
          days: plan.days.map((day) => day.day === dayName
            ? {
                ...day,
                meals: day.meals.map((meal, index) => index === mealIndex ? { ...meal, servings } : meal),
              }
            : day),
        }
      : plan);
  }

  async function savePlan() {
    if (!current) return;
    setError(null);
    setNotice(null);
    setIsSaving(true);
    try {
      const preferences = weeklyPlanRecordSchema.shape.preferences.parse(current.preferences);
      const days = weeklyPlanScheduleSchema.parse(current.days);
      const body = { name: planName.trim() || "My Weekly Plan", preferences, days };
      const response = await fetch(current.id ? `/api/weekly-plans/${current.id}` : "/api/weekly-plans", {
        method: current.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await responseError(response, "Unable to save this weekly plan."));
      const payload: unknown = await response.json();
      const saved = weeklyPlanRecordSchema.parse(isRecord(payload) ? payload.plan : undefined);
      setCurrent(saved);
      setPlans((existing) => [saved, ...existing.filter((plan) => plan.id !== saved.id)]);
      setPlanName(saved.name);
      setNotice("Weekly plan saved. You can return to it any time.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this weekly plan.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePlan(plan: WeeklyPlan) {
    setError(null);
    setNotice(null);
    setIsDeleting(plan.id);
    try {
      const response = await fetch(`/api/weekly-plans/${plan.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "Unable to delete this weekly plan."));
      const remaining = plans.filter((item) => item.id !== plan.id);
      setPlans(remaining);
      if (current?.id === plan.id) {
        if (remaining[0]) openPlan(remaining[0]);
        else {
          setCurrent(null);
          setIsCreating(false);
        }
      }
      setNotice("Weekly plan deleted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete this weekly plan.");
    } finally {
      setIsDeleting(null);
    }
  }

  const newPlan = !current && !isCreating;
  const isBusy = isGenerating !== null || isSaving || isDeleting !== null;
  const activeStep = current?.id ? 3 : current ? 2 : isCreating ? 0 : -1;

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--leaf)]">7-day meal planner</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">A week of meals, built around you.</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              Set your calorie target and food preferences. AI will create a Monday-to-Sunday schedule with estimated calories and nutrition for every meal.
            </p>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={startNewPlan}
            className="active-press inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--leaf)] px-5 py-3 text-sm font-bold text-[var(--on-leaf)] shadow-xs transition hover:bg-[var(--leaf-deep)] disabled:opacity-50"
          >
            + Create Plan
          </button>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-4">
          {["Choose preferences", "Generate 7 days", "Review and customize", "Save and revisit"].map((step, index) => (
            <div
              aria-current={activeStep === index ? "step" : undefined}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${activeStep >= index ? "bg-[var(--leaf-light)] text-[var(--leaf-ink)]" : "bg-[var(--surface-muted)] text-[var(--ink-muted)]"}`}
              key={step}
            >
              <span className={`grid size-6 shrink-0 place-items-center rounded-full ${activeStep >= index ? "bg-[var(--leaf)] text-[var(--on-leaf)]" : "bg-[var(--line)] text-[var(--ink-muted)]"}`}>{index + 1}</span>
              {step}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="rounded-2xl border border-[var(--coral)]/30 bg-[var(--coral)]/10 p-4 text-sm font-semibold text-[var(--coral)]" role="alert">{error}</p>}
      {notice && <p className="rounded-2xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-4 text-sm font-semibold text-[var(--leaf-ink)]" role="status">{notice}</p>}

      {(plans.length > 0 || isLoading) && (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <h3 className="font-bold text-[var(--foreground)]">Saved weekly plans</h3>
          {isLoading ? (
            <p className="mt-3 text-sm text-[var(--ink-muted)]">Loading your saved plans…</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {plans.map((plan) => (
                <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1" key={plan.id}>
                  <button
                    type="button"
                    disabled={isBusy}
                    aria-current={current?.id === plan.id ? "true" : undefined}
                    onClick={() => openPlan(plan)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${current?.id === plan.id ? "bg-[var(--leaf)] text-[var(--on-leaf)]" : "text-[var(--foreground)] hover:bg-[var(--line)]"}`}
                  >
                    {plan.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${plan.name}`}
                    disabled={isBusy}
                    onClick={() => setPlanToDelete(plan)}
                    className="min-h-11 min-w-11 rounded-lg px-2 py-2 text-xs text-[var(--coral)] hover:bg-[var(--coral)]/10 disabled:opacity-50"
                  >
                    {isDeleting === plan.id ? "…" : "×"}
                  </button>
                </div>
              ))}
            </div>
          )}
          {planToDelete && (
            <div ref={deleteDialogRef} className="rounded-2xl border border-[var(--coral)]/30 bg-[var(--coral)]/10 p-4" role="alertdialog" aria-modal="true" aria-labelledby="delete-plan-title" aria-describedby="delete-plan-description" tabIndex={-1}>
              <h3 id="delete-plan-title" className="font-semibold text-[var(--foreground)]">Delete this weekly plan?</h3>
              <p className="mt-2 text-sm text-[var(--ink-muted)]" id="delete-plan-description">&quot;{planToDelete.name}&quot; will be permanently removed. This cannot be undone.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="min-h-11 rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-semibold" onClick={() => setPlanToDelete(null)}>Keep plan</button>
                <button type="button" className="min-h-11 rounded-xl bg-[var(--coral)] px-4 py-2 text-sm font-semibold text-white" onClick={() => { const plan = planToDelete; setPlanToDelete(null); void deletePlan(plan); }}>Delete plan</button>
              </div>
            </div>
          )}
        </section>
      )}

      {isCreating && (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--leaf)]">Step 2 · Preferences</p>
            <h3 className="mt-1 text-xl font-bold">What should your week look like?</h3>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Plan name
              <input value={planName} onChange={(event) => setPlanName(event.target.value)} maxLength={100} disabled={isBusy} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 font-normal disabled:opacity-60" />
            </label>
            <label className="text-sm font-semibold">
              Daily calorie target
              <span className="relative mt-2 block">
                <input type="number" min={800} max={6000} step={50} value={calorieTarget} onChange={(event) => setCalorieTarget(event.target.value)} disabled={isBusy} className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 pr-16 font-normal disabled:opacity-60" />
                <span className="pointer-events-none absolute right-3 top-2.5 text-xs font-normal text-[var(--ink-muted)]">kcal/day</span>
              </span>
            </label>
            <label className="text-sm font-semibold">
              Meals per day
              <select value={mealsPerDay} onChange={(event) => setMealsPerDay(event.target.value)} disabled={isBusy} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 font-normal disabled:opacity-60">
                {[2, 3, 4, 5, 6].map((count) => <option value={count} key={count}>{count} meals</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Preferred foods
              <input value={preferredFoods} onChange={(event) => setPreferredFoods(event.target.value)} disabled={isBusy} placeholder="e.g. chicken, rice, vegetables" className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 font-normal disabled:opacity-60" />
              <span className="mt-1 block text-xs font-normal text-[var(--ink-muted)]">Separate foods with commas.</span>
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Food restrictions
              <input value={foodRestrictions} onChange={(event) => setFoodRestrictions(event.target.value)} disabled={isBusy} placeholder="e.g. vegetarian, no peanuts, dairy-free" className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 font-normal disabled:opacity-60" />
              <span className="mt-1 block text-xs font-normal text-[var(--ink-muted)]">List allergies or ingredients you want the plan to avoid.</span>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={isGenerating !== null} onClick={() => void generate("week")} className="active-press rounded-xl bg-[var(--leaf)] px-5 py-3 text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50">
              {isGenerating === "week" ? "Generating your week…" : <><IconSparkles className="size-4" aria-hidden="true" /> Generate 7-Day Plan</>}
            </button>
            <button type="button" onClick={() => setIsCreating(false)} className="rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--ink-muted)] hover:bg-[var(--surface-muted)]">Cancel</button>
          </div>
        </section>
      )}

      {newPlan && !isLoading && !isCreating && !error && (
        <section className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center">
          <p className="text-sm text-[var(--ink-muted)]">You don’t have a saved weekly plan yet.</p>
          <button type="button" onClick={startNewPlan} className="mt-4 rounded-xl bg-[var(--leaf)] px-5 py-3 text-sm font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)]">Create your first plan</button>
        </section>
      )}

      {current && !isCreating && (
        <section className="space-y-5">
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:flex-row sm:items-end">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--leaf)]">Step 4 · Review and customize</p>
              <label className="mt-2 block max-w-lg text-sm font-semibold">
                Plan name
                <input value={planName} onChange={(event) => setPlanName(event.target.value)} maxLength={100} disabled={isBusy} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 font-normal disabled:opacity-60" />
              </label>
              <p className="mt-2 text-xs text-[var(--ink-muted)]">Target: {current.preferences.dailyCalorieTarget.toLocaleString()} kcal/day · {current.preferences.mealsPerDay} meals/day</p>
            </div>
            <button type="button" disabled={isSaving || isGenerating !== null} onClick={() => void savePlan()} className="active-press rounded-xl bg-[var(--leaf)] px-5 py-3 text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50">
              {isSaving ? "Saving…" : current.id ? "Save changes" : "Save Weekly Plan"}
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {current.days.map((day) => {
              const totalCalories = day.meals.reduce((total, meal) => total + caloriesFor(meal), 0);
              const targetCalories = current.preferences.dailyCalorieTarget || 2000;
              const calPercent = Math.round((totalCalories / targetCalories) * 100);
              const isToday = day.day === todayName;

              return (
                <article
                  className={`overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-xs transition-all ${
                    isToday ? "border-[var(--leaf)] ring-2 ring-[var(--leaf)]/30" : "border-[var(--line)]"
                  }`}
                  key={day.day}
                >
                  <header className="border-b border-[var(--line)] bg-[var(--surface-muted)] px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[var(--foreground)]">{day.day}</h3>
                        {isToday && (
                          <span className="rounded-full bg-[var(--leaf)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--on-leaf)] shadow-2xs">
                            Today
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={isGenerating !== null}
                        onClick={() => void generate("day", { day: day.day })}
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--leaf-ink)] hover:border-[var(--leaf)] disabled:opacity-50"
                      >
                        {isGenerating === `day-${day.day}-` ? "Regenerating..." : "Regenerate day"}
                      </button>
                    </div>

                    {/* Day Calorie Target Comparison Bar */}
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--ink-muted)]">
                          {Math.round(totalCalories).toLocaleString()} / {targetCalories.toLocaleString()} kcal
                        </span>
                        <span className={`tabular-nums font-bold ${calPercent > 105 ? "text-[var(--coral)]" : "text-[var(--leaf)]"}`}>
                          {calPercent}% target
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]/60">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${calPercent > 105 ? "bg-[var(--coral)]" : "bg-[var(--leaf)]"}`}
                          style={{ width: `${Math.min(calPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </header>
                  <div className="divide-y divide-[var(--line)]/70">
                    {day.meals.map((meal, index) => {
                      const slot = getMealSlotLabel(day.meals.length, index);
                      const isReplacing = isGenerating === `meal-${day.day}-${slot}`;
                      const isSavingRecipe = savingRecipeTitle === meal.title;
                      return (
                        <div className="p-5" key={`${day.day}-${slot}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--leaf)]">{slot}</p>
                              <h4 className="mt-1 font-bold text-[var(--foreground)]">{meal.title}</h4>
                              <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{meal.description}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isSavingRecipe}
                                onClick={() => void saveMealAsRecipe(meal)}
                                className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:border-[var(--leaf)] hover:text-[var(--leaf)] disabled:opacity-50"
                                title="Save this meal idea into your Recipe collection in Meal Plans"
                              >
                                {isSavingRecipe ? "Saving..." : "+ Recipe"}
                              </button>
                              <button
                                type="button"
                                disabled={isGenerating !== null}
                                onClick={() => void generate("meal", { day: day.day, slot, currentTitle: meal.title })}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--leaf-ink)] hover:bg-[var(--leaf-light)] disabled:opacity-50"
                              >
                                {isReplacing ? "Replacing..." : "Replace"}
                              </button>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                            <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-xs">
                              <span className="font-bold text-[var(--foreground)]">{caloriesFor(meal)} kcal</span>
                              <span className="text-[var(--ink-muted)]">P {Math.round(meal.nutrition.proteinG * meal.servings)}g</span>
                              <span className="text-[var(--ink-muted)]">C {Math.round(meal.nutrition.carbsG * meal.servings)}g</span>
                              <span className="text-[var(--ink-muted)]">F {Math.round(meal.nutrition.fatG * meal.servings)}g</span>
                            </div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-muted)]">
                              Servings
                              <input aria-label={`${day.day} ${slot} servings`} type="number" min={0.25} max={12} step={0.25} value={meal.servings} disabled={isBusy} onChange={(event) => updateServings(day.day, index, Number(event.target.value))} className="w-20 rounded-lg border border-[var(--line)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)] disabled:opacity-60" />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
          <p className="text-xs leading-5 text-[var(--ink-muted)]">Nutrition and calorie values are AI-generated estimates per serving. Adjust servings to update displayed meal totals. AI may miss allergens; verify ingredients before eating, especially if you have an allergy. Estimates are for planning and are not medical advice.</p>
        </section>
      )}
    </section>
  );
}
