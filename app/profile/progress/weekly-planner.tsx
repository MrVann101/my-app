"use client";

import { useEffect, useState } from "react";
import Dialog from "@/components/dialog";
import { IconCheck, IconPlus, IconSparkles, IconX } from "@/components/icons";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";
import { normalizeMealSlot, type MealSlot } from "@/lib/meal-slot";
import {
  WEEK_DAYS,
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

function slotToMealType(slotLabel: string): MealSlot {
  const lower = slotLabel.toLowerCase();
  if (lower.includes("breakfast")) return "breakfast";
  if (lower.includes("lunch")) return "lunch";
  if (lower.includes("dinner")) return "dinner";
  return normalizeMealSlot(lower) ?? "snack";
}

export default function WeeklyPlanner() {
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [current, setCurrent] = useState<PlanDraft | null>(null);
  const [userProfileTarget, setUserProfileTarget] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [savingRecipeTitle, setSavingRecipeTitle] = useState<string | null>(null);
  const [loggingMealKey, setLoggingMealKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [planToDelete, setPlanToDelete] = useState<WeeklyPlan | null>(null);
  const [planName, setPlanName] = useState("My Weekly Plan");
  const [calorieTarget, setCalorieTarget] = useState(String(defaultPreferences.dailyCalorieTarget));
  const [mealsPerDay, setMealsPerDay] = useState(String(defaultPreferences.mealsPerDay));
  const [preferredFoods, setPreferredFoods] = useState("");
  const [foodRestrictions, setFoodRestrictions] = useState("");
  const [todayName, setTodayName] = useState<string>("");
  const [mobileDayFilter, setMobileDayFilter] = useState<string>("all");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
      setTodayName(weekday);
      setMobileDayFilter(weekday);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
          setIsDirty(false);
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
    setIsDirty(false);
    setIsCreating(true);
  }

  async function saveMealAsRecipe(meal: WeeklyPlanMeal) {
    setSavingRecipeTitle(meal.title);
    setError(null);
    setNotice(null);
    try {
      const integerServings = Math.max(1, Math.min(12, Math.round(meal.servings) || 1));
      const response = await fetch("/api/meal-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: meal.title,
          visibility: "private",
          recipe: {
            title: meal.title,
            description: meal.description || "Saved from your weekly plan.",
            cookTimeMinutes: 20,
            servings: integerServings,
            nutrition: {
              calories: Math.round(meal.nutrition.calories * meal.servings),
              proteinG: Math.round(meal.nutrition.proteinG * meal.servings),
              carbsG: Math.round(meal.nutrition.carbsG * meal.servings),
              fatG: Math.round(meal.nutrition.fatG * meal.servings),
            },
            ingredients: [{ name: meal.title, amount: "1 serving", pantryStaple: false }],
            steps: [meal.description.trim() || "Prepare and portion the meal according to your daily plan."],
          },
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Unable to save this recipe."));
      setNotice(`Saved "${meal.title}" to My Plans.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save recipe.");
    } finally {
      setSavingRecipeTitle(null);
    }
  }

  async function logMealToday(dayName: string, slotLabel: string, meal: WeeklyPlanMeal) {
    const key = `${dayName}-${slotLabel}`;
    setLoggingMealKey(key);
    setError(null);
    setNotice(null);
    try {
      const mealType = slotToMealType(slotLabel);
      const response = await fetch("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate: getBrowserDate(),
          timezone: getBrowserTimezone(),
          mealType,
          foodName: meal.title,
          weightG: meal.servings,
          nutrientRate: {
            caloriesPerG: meal.nutrition.calories,
            proteinPerG: meal.nutrition.proteinG,
            carbsPerG: meal.nutrition.carbsG,
            fatPerG: meal.nutrition.fatG,
            fiberPerG: 0,
            sodiumPerG: 0,
            sugarPerG: 0,
          },
          source: "database",
          dataSource: null,
          aiConfidence: null,
          isRecipe: true,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Unable to log this meal."));
      setNotice(`Logged "${meal.title}" (${caloriesFor(meal)} kcal) as ${mealType} to today's journal.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log meal.");
    } finally {
      setLoggingMealKey(null);
    }
  }

  function openPlan(plan: WeeklyPlan) {
    setCurrent(plan);
    setPlanName(plan.name);
    setPreferencesForm(plan.preferences);
    setIsCreating(false);
    setIsDirty(false);
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
        setIsDirty(true);
        setNotice("Your 7-day plan is ready. Review and customize it, then save.");
      } else if (action === "day") {
        const regenerated = weeklyPlanDaySchema.parse(payload.day);
        setCurrent((plan) =>
          plan ? { ...plan, days: plan.days.map((day) => (day.day === regenerated.day ? regenerated : day)) } : plan,
        );
        setIsDirty(true);
        setNotice(`${regenerated.day} has been regenerated. Save changes to keep it.`);
      } else {
        const meal = weeklyPlanMealSchema.parse(payload.meal);
        const dayName = extra.day;
        const slot = extra.slot;
        setCurrent((plan) =>
          plan
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
            : plan,
        );
        setIsDirty(true);
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
    setCurrent((plan) =>
      plan
        ? {
            ...plan,
            days: plan.days.map((day) =>
              day.day === dayName
                ? {
                    ...day,
                    meals: day.meals.map((meal, index) => (index === mealIndex ? { ...meal, servings } : meal)),
                  }
                : day,
            ),
          }
        : plan,
    );
    setIsDirty(true);
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
      setIsDirty(false);
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
          setIsDirty(false);
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

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
              7-Day Meal Schedule
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Personalized Monday-to-Sunday plan calculated to hit your daily nutrition targets.
            </p>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={startNewPlan}
            className="hover-lift active-press inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--leaf)] px-4 text-xs font-bold text-[var(--on-leaf)] shadow-xs transition-colors hover:bg-[var(--leaf-deep)] disabled:opacity-50"
          >
            <IconPlus className="size-4" />
            <span>Create New Plan</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-2xl border border-[var(--coral)]/30 bg-[var(--coral-soft)] p-4 text-sm font-semibold text-[var(--coral)]" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="flex items-center gap-2 rounded-2xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-4 text-sm font-semibold text-[var(--leaf-ink)]" role="status">
          <IconCheck className="size-4 shrink-0" />
          <span>{notice}</span>
        </p>
      )}

      {(plans.length > 0 || isLoading) && (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <h3 className="font-bold text-[var(--foreground)]">Saved weekly plans</h3>
          {isLoading ? (
            <div className="mt-3 flex gap-2 animate-pulse">
              <div className="h-11 w-36 rounded-xl bg-[var(--surface-muted)]" />
              <div className="h-11 w-36 rounded-xl bg-[var(--surface-muted)]" />
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {plans.map((plan) => (
                <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1" key={plan.id}>
                  <button
                    type="button"
                    disabled={isBusy}
                    aria-current={current?.id === plan.id ? "true" : undefined}
                    onClick={() => openPlan(plan)}
                    className={`active-press min-h-11 rounded-lg px-3.5 text-xs font-semibold ${
                      current?.id === plan.id
                        ? "bg-[var(--leaf)] text-[var(--on-leaf)]"
                        : "text-[var(--foreground)] hover:bg-[var(--line)]"
                    }`}
                  >
                    {plan.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${plan.name}`}
                    disabled={isBusy}
                    onClick={() => setPlanToDelete(plan)}
                    className="grid min-h-11 min-w-11 place-items-center rounded-lg text-[var(--coral)] hover:bg-[var(--coral-soft)] disabled:opacity-50"
                  >
                    {isDeleting === plan.id ? "…" : <IconX className="size-4" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {isCreating && (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--leaf)]">Preferences</p>
            <h3 className="mt-1 text-lg font-bold">What should your week look like?</h3>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold" htmlFor="wp-name">Plan name</label>
              <input
                id="wp-name"
                value={planName}
                onChange={(event) => setPlanName(event.target.value)}
                maxLength={100}
                disabled={isBusy}
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 font-normal outline-none focus:border-[var(--leaf)] disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="wp-calories">Daily calorie target</label>
              <div className="relative mt-2">
                <input
                  id="wp-calories"
                  type="number"
                  inputMode="numeric"
                  min={800}
                  max={6000}
                  step={50}
                  value={calorieTarget}
                  onChange={(event) => setCalorieTarget(event.target.value)}
                  disabled={isBusy}
                  className="tabular-nums h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 pr-16 font-normal outline-none focus:border-[var(--leaf)] disabled:opacity-60"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-normal text-[var(--ink-muted)]">kcal/day</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="wp-meals-per-day">Meals per day</label>
              <select
                id="wp-meals-per-day"
                value={mealsPerDay}
                onChange={(event) => setMealsPerDay(event.target.value)}
                disabled={isBusy}
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 font-normal outline-none focus:border-[var(--leaf)] disabled:opacity-60"
              >
                {[2, 3, 4, 5, 6].map((count) => <option value={count} key={count}>{count} meals</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="wp-preferred">Preferred foods</label>
              <input
                id="wp-preferred"
                value={preferredFoods}
                onChange={(event) => setPreferredFoods(event.target.value)}
                disabled={isBusy}
                placeholder="e.g. chicken, rice, vegetables"
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 font-normal outline-none focus:border-[var(--leaf)] disabled:opacity-60"
              />
              <span className="mt-1 block text-xs font-normal text-[var(--ink-muted)]">Separate foods with commas.</span>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold" htmlFor="wp-restrictions">Food restrictions</label>
              <input
                id="wp-restrictions"
                value={foodRestrictions}
                onChange={(event) => setFoodRestrictions(event.target.value)}
                disabled={isBusy}
                placeholder="e.g. vegetarian, no peanuts, dairy-free"
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 font-normal outline-none focus:border-[var(--leaf)] disabled:opacity-60"
              />
              <span className="mt-1 block text-xs font-normal text-[var(--ink-muted)]">List allergies or ingredients to avoid.</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isGenerating !== null}
              onClick={() => void generate("week")}
              className="active-press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--leaf)] px-5 text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
            >
              <IconSparkles className="size-4" />
              <span>{isGenerating === "week" ? "Generating your week…" : "Generate 7-Day Plan"}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="active-press min-h-12 rounded-xl border border-[var(--border-control)] px-5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {newPlan && !isLoading && !isCreating && !error && (
        <section className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center">
          <p className="text-sm text-[var(--ink-muted)]">You don&apos;t have a saved weekly plan yet.</p>
          <button
            type="button"
            onClick={startNewPlan}
            className="active-press mt-4 min-h-12 rounded-xl bg-[var(--leaf)] px-5 text-sm font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)]"
          >
            Create your first plan
          </button>
        </section>
      )}

      {current && !isCreating && (
        <section className="space-y-5">
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:flex-row sm:items-end">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--leaf)]">Review &amp; customize</p>
              <label className="mt-2 block max-w-lg text-sm font-semibold" htmlFor="wp-edit-name">
                Plan name
                <input
                  id="wp-edit-name"
                  value={planName}
                  onChange={(event) => {
                    setPlanName(event.target.value);
                    setIsDirty(true);
                  }}
                  maxLength={100}
                  disabled={isBusy}
                  className="mt-2 h-11 w-full rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 font-normal outline-none focus:border-[var(--leaf)] disabled:opacity-60"
                />
              </label>
              <p className="mt-2 text-xs text-[var(--ink-muted)]">
                Target: {current.preferences.dailyCalorieTarget.toLocaleString()} kcal/day · {current.preferences.mealsPerDay} meals/day
              </p>
            </div>
            <button
              type="button"
              disabled={isSaving || isGenerating !== null}
              onClick={() => void savePlan()}
              className="active-press min-h-12 rounded-xl bg-[var(--leaf)] px-5 text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
            >
              {isSaving ? "Saving…" : current.id ? (isDirty ? "Save changes *" : "Save changes") : "Save Weekly Plan"}
            </button>
          </div>

          {/* Mobile Day Switcher Strip (avoids 4,000px stack on phones) */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 xl:hidden" role="tablist" aria-label="Filter day of week">
            <button
              type="button"
              role="tab"
              aria-selected={mobileDayFilter === "all"}
              onClick={() => setMobileDayFilter("all")}
              className={`active-press min-h-11 shrink-0 rounded-xl px-3.5 text-xs font-bold transition-colors ${
                mobileDayFilter === "all"
                  ? "bg-[var(--leaf)] text-[var(--on-leaf)]"
                  : "border border-[var(--border-control)] bg-[var(--surface)] text-[var(--ink-muted)]"
              }`}
            >
              All 7 days
            </button>
            {WEEK_DAYS.map((day) => (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={mobileDayFilter === day}
                onClick={() => setMobileDayFilter(day)}
                className={`active-press min-h-11 shrink-0 rounded-xl px-3.5 text-xs font-bold transition-colors ${
                  mobileDayFilter === day
                    ? "bg-[var(--leaf)] text-[var(--on-leaf)]"
                    : "border border-[var(--border-control)] bg-[var(--surface)] text-[var(--ink-muted)]"
                }`}
              >
                {day.slice(0, 3)}{day === todayName ? " · Today" : ""}
              </button>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {current.days.map((day) => {
              const totalCalories = day.meals.reduce((total, meal) => total + caloriesFor(meal), 0);
              const targetCalories = current.preferences.dailyCalorieTarget || 2000;
              const calPercent = Math.round((totalCalories / targetCalories) * 100);
              const isToday = day.day === todayName;
              const hiddenOnMobile = mobileDayFilter !== "all" && mobileDayFilter !== day.day;

              return (
                <article
                  className={`${hiddenOnMobile ? "hidden xl:block" : ""} overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-xs transition-colors ${
                    isToday ? "border-[var(--leaf)] ring-2 ring-[var(--leaf)]/30" : "border-[var(--line)]"
                  }`}
                  key={day.day}
                >
                  <header className="border-b border-[var(--line)] bg-[var(--surface-muted)] px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
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
                        className="active-press min-h-11 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3.5 text-xs font-bold text-[var(--leaf-ink)] hover:border-[var(--leaf)] disabled:opacity-50"
                      >
                        {isGenerating === `day-${day.day}-` ? "Regenerating..." : "Regenerate day"}
                      </button>
                    </div>

                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="tabular-nums font-semibold text-[var(--ink-muted)]">
                          {Math.round(totalCalories).toLocaleString()} / {targetCalories.toLocaleString()} kcal
                        </span>
                        <span className={`tabular-nums font-bold ${calPercent > 105 ? "text-[var(--coral)]" : "text-[var(--leaf)]"}`}>
                          {calPercent}% target
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]/60">
                        <div
                          className={`h-full w-full origin-left rounded-full transition-transform duration-300 ${
                            calPercent > 105 ? "bg-[var(--coral)]" : "bg-[var(--leaf)]"
                          }`}
                          style={{ transform: `scaleX(${Math.min(calPercent, 100) / 100})` }}
                        />
                      </div>
                    </div>
                  </header>

                  <div className="divide-y divide-[var(--line)]/70">
                    {day.meals.map((meal, index) => {
                      const slot = getMealSlotLabel(day.meals.length, index);
                      const isReplacing = isGenerating === `meal-${day.day}-${slot}`;
                      const isSavingRecipe = savingRecipeTitle === meal.title;
                      const isLoggingToday = loggingMealKey === `${day.day}-${slot}`;
                      return (
                        <div className="space-y-3 p-5" key={`${day.day}-${slot}`}>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--leaf)]">{slot}</p>
                            <h4 className="mt-1 font-bold text-[var(--foreground)]">{meal.title}</h4>
                            <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{meal.description}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={isLoggingToday || isBusy}
                              onClick={() => void logMealToday(day.day, slot, meal)}
                              className="active-press inline-flex min-h-11 items-center gap-1 rounded-xl bg-[var(--leaf)] px-3.5 text-xs font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:opacity-50"
                            >
                              <IconPlus className="size-3.5" />
                              <span>{isLoggingToday ? "Logging..." : "Log today"}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isSavingRecipe}
                              onClick={() => void saveMealAsRecipe(meal)}
                              className="active-press min-h-11 rounded-xl border border-[var(--border-control)] bg-[var(--surface-muted)] px-3.5 text-xs font-semibold text-[var(--foreground)] hover:border-[var(--leaf)] hover:text-[var(--leaf)] disabled:opacity-50"
                              title="Save this meal into My Plans"
                            >
                              {isSavingRecipe ? "Saving..." : "+ Save Recipe"}
                            </button>
                            <button
                              type="button"
                              disabled={isGenerating !== null}
                              onClick={() => void generate("meal", { day: day.day, slot, currentTitle: meal.title })}
                              className="active-press min-h-11 rounded-xl px-3.5 text-xs font-semibold text-[var(--leaf-ink)] hover:bg-[var(--leaf-light)] disabled:opacity-50"
                            >
                              {isReplacing ? "Replacing..." : "Replace"}
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                            <div className="tabular-nums grid grid-cols-4 gap-x-4 gap-y-1 text-xs">
                              <span className="font-bold text-[var(--foreground)]">{caloriesFor(meal)} kcal</span>
                              <span className="text-[var(--ink-muted)]">P {Math.round(meal.nutrition.proteinG * meal.servings)}g</span>
                              <span className="text-[var(--ink-muted)]">C {Math.round(meal.nutrition.carbsG * meal.servings)}g</span>
                              <span className="text-[var(--ink-muted)]">F {Math.round(meal.nutrition.fatG * meal.servings)}g</span>
                            </div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-muted)]">
                              Servings
                              <input
                                aria-label={`${day.day} ${slot} servings`}
                                type="number"
                                inputMode="decimal"
                                min={0.25}
                                max={12}
                                step={0.25}
                                value={meal.servings}
                                disabled={isBusy}
                                onChange={(event) => updateServings(day.day, index, Number(event.target.value))}
                                className="tabular-nums h-11 w-20 rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-2.5 text-sm text-[var(--foreground)] disabled:opacity-60"
                              />
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

          {isDirty && (
            <div className="sticky bottom-20 z-20 flex items-center justify-between gap-3 rounded-2xl border border-[var(--leaf)] bg-[var(--surface)] px-4 py-3 shadow-lg md:bottom-4">
              <span className="text-xs font-bold text-[var(--foreground)]">You have unsaved changes</span>
              <button
                type="button"
                disabled={isSaving || isGenerating !== null}
                onClick={() => void savePlan()}
                className="active-press min-h-11 rounded-xl bg-[var(--leaf)] px-4 text-xs font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save plan"}
              </button>
            </div>
          )}

          <p className="text-xs leading-5 text-[var(--ink-muted)]">
            Nutrition and calorie values are AI-generated estimates per serving. Adjust servings to update displayed meal totals. AI may miss allergens; verify ingredients before eating, especially if you have an allergy. Estimates are for planning and are not medical advice.
          </p>
        </section>
      )}

      <Dialog
        open={Boolean(planToDelete)}
        onClose={() => setPlanToDelete(null)}
        role="alertdialog"
        titleId="delete-plan-title"
        descriptionId="delete-plan-description"
      >
        <h3 id="delete-plan-title" className="text-base font-bold text-[var(--foreground)]">
          Delete this weekly plan?
        </h3>
        <p className="mt-2 text-sm text-[var(--ink-muted)]" id="delete-plan-description">
          &quot;{planToDelete?.name}&quot; will be permanently removed. This cannot be undone.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="active-press min-h-11 rounded-xl border border-[var(--border-control)] text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
            onClick={() => setPlanToDelete(null)}
          >
            Keep plan
          </button>
          <button
            type="button"
            className="active-press min-h-11 rounded-xl bg-[var(--coral)] text-sm font-bold text-[var(--on-coral)] hover:opacity-90"
            onClick={() => {
              if (!planToDelete) return;
              const plan = planToDelete;
              setPlanToDelete(null);
              void deletePlan(plan);
            }}
          >
            Delete plan
          </button>
        </div>
      </Dialog>
    </section>
  );
}
