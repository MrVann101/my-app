"use client";

import { useEffect, useRef, useState } from "react";
import Dialog from "@/components/dialog";
import WeeklyDayView from "@/components/weekly-plan/weekly-day-view";
import WeeklyGroceryList, { type GroceryPlanOption } from "@/components/weekly-plan/weekly-grocery-list";
import { IconCalendar, IconCheck, IconEdit, IconMealPlans, IconPlus, IconShoppingBag, IconSparkles, IconTrash } from "@/components/icons";
import { getBrowserDate, getBrowserTimezone } from "@/lib/date";
import { normalizeMealSlot, type MealSlot } from "@/lib/meal-slot";
import { countWeeklyGroceryItems } from "@/lib/weekly-grocery";
import {
  createDraftPlanKey,
  getPlanGroceryKey,
  loadPlanGroceryState,
  migrateDraftGroceryState,
  removePlanGroceryState,
  savePlanGroceryState,
} from "@/lib/weekly-grocery-storage";
import {
  EMPTY_GROCERY_STATE,
  WEEK_DAYS,
  computeWeeklySummary,
  getMealSlotLabel,
  isGenericSlotTitle,
  parsePreferenceList,
  weeklyPlanRecordSchema,
  weeklyPlanScheduleSchema,
  weeklyPlanDaySchema,
  weeklyPlanMealSchema,
  type WeeklyPlan,
  type WeeklyPlanDay,
  type WeeklyPlanGroceryState,
  type WeeklyPlanMeal,
  type WeeklyPlanPreferences,
} from "@/lib/weekly-plan-schemas";

const defaultPreferences: WeeklyPlanPreferences = {
  dailyCalorieTarget: 2000,
  mealsPerDay: 3,
  preferredFoods: [],
  foodRestrictions: [],
};

const CALORIE_PRESETS = [1600, 1800, 2000, 2400] as const;
const MEALS_PER_DAY_OPTIONS = [2, 3, 4, 5, 6] as const;

type PlanDraft = {
  id?: number;
  draftId?: string;
  isActive?: boolean;
  name: string;
  preferences: WeeklyPlanPreferences;
  days: WeeklyPlanDay[];
  groceryState?: WeeklyPlanGroceryState;
};

function nextDefaultPlanName(existingPlans: readonly WeeklyPlan[]): string {
  const used = new Set(existingPlans.map((plan) => plan.name.trim().toLowerCase()));
  if (!used.has("my weekly plan")) return "My Weekly Plan";
  let index = 2;
  while (used.has(`weekly plan ${index}`)) {
    index += 1;
  }
  return `Weekly Plan ${index}`;
}

function collectExistingDishTitles(existingPlans: readonly WeeklyPlan[]): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const plan of existingPlans) {
    for (const day of plan.days) {
      for (const meal of day.meals) {
        const trimmed = meal.title.trim();
        if (!trimmed || isGenericSlotTitle(trimmed)) continue;
        const lower = trimmed.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);
        titles.push(trimmed);
        if (titles.length >= 24) return titles;
      }
    }
  }
  return titles;
}

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
  const [isRenaming, setIsRenaming] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isSettingActiveId, setIsSettingActiveId] = useState<number | null>(null);
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
  const [selectedDay, setSelectedDay] = useState<WeeklyPlanDay["day"]>("Monday");
  const [activeSection, setActiveSection] = useState<"schedule" | "grocery" | "saved">("schedule");
  const [groceryStateByKey, setGroceryStateByKey] = useState<Record<string, WeeklyPlanGroceryState>>({});
  const grocerySyncTimersRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const timers = grocerySyncTimersRef.current;
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
      const matchedDay = WEEK_DAYS.find((day) => day === weekday);
      if (matchedDay) {
        setTodayName(matchedDay);
        setSelectedDay(matchedDay);
      }
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
        const nextGroceryMap: Record<string, WeeklyPlanGroceryState> = {};
        for (const plan of savedPlans) {
          const key = getPlanGroceryKey(plan);
          nextGroceryMap[key] = loadPlanGroceryState(key, plan.groceryState);
        }
        setGroceryStateByKey(nextGroceryMap);
        setUserProfileTarget(profileTarget);
        setPlans(savedPlans);
        const initialPlan = savedPlans.find((plan) => plan.isActive) ?? savedPlans[0];
        if (initialPlan) {
          setCurrent(initialPlan);
          setPlanName(initialPlan.name);
          setPreferencesForm(initialPlan.preferences);
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
    setPlanName(nextDefaultPlanName(plans));
    setPreferencesForm(userProfileTarget ? { ...defaultPreferences, dailyCalorieTarget: userProfileTarget } : defaultPreferences);
    setIsRenaming(false);
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
            ingredients: (meal.ingredients && meal.ingredients.length > 0
              ? meal.ingredients
              : [meal.title]
            ).map((name) => ({ name, amount: "1 serving", pantryStaple: false })),
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

  function openPlan(plan: WeeklyPlan, targetSection: "schedule" | "grocery" | "keep" = "schedule") {
    const planKey = getPlanGroceryKey(plan);
    setGroceryStateByKey((prev) =>
      prev[planKey] ? prev : { ...prev, [planKey]: loadPlanGroceryState(planKey, plan.groceryState) },
    );
    setCurrent(plan);
    setPlanName(plan.name);
    setPreferencesForm(plan.preferences);
    setIsRenaming(false);
    setIsCreating(false);
    if (targetSection !== "keep") setActiveSection(targetSection);
    setIsDirty(false);
    setError(null);
    setNotice(null);
  }

  async function setActivePlan(planId: number) {
    setError(null);
    setNotice(null);
    setIsSettingActiveId(planId);
    try {
      const response = await fetch(`/api/weekly-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Unable to update active plan."));
      const payload: unknown = await response.json();
      const updated = weeklyPlanRecordSchema.parse(isRecord(payload) ? payload.plan : undefined);
      const activatedKey = getPlanGroceryKey(updated);
      const existingEntry = plans.find((item) => item.id === updated.id);
      const resolvedGroceryState =
        groceryStateByKey[activatedKey] ??
        updated.groceryState ??
        existingEntry?.groceryState ??
        loadPlanGroceryState(activatedKey, updated.groceryState);

      setGroceryStateByKey((prev) => ({ ...prev, [activatedKey]: resolvedGroceryState }));
      setPlans((existing) => [
        { ...updated, groceryState: resolvedGroceryState },
        ...existing
          .filter((item) => item.id !== updated.id)
          .map((item) => ({ ...item, isActive: false })),
      ]);

      const keepingSameUnsavedPlan = current?.id === updated.id && isDirty;
      if (keepingSameUnsavedPlan) {
        setCurrent((prev) =>
          prev?.id === updated.id
            ? {
                ...updated,
                days: prev.days,
                name: prev.name,
                groceryState: resolvedGroceryState,
              }
            : prev,
        );
      } else {
        setCurrent({ ...updated, groceryState: resolvedGroceryState });
        setPlanName(updated.name);
        setPreferencesForm(updated.preferences);
        setIsRenaming(false);
        setIsDirty(false);
      }
      setNotice(`Set "${updated.name}" as your active weekly plan.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update active plan.");
    } finally {
      setIsSettingActiveId(null);
    }
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
        body: JSON.stringify({
          action,
          preferences,
          ...(action === "week" ? { excludeTitles: collectExistingDishTitles(plans) } : {}),
          ...extra,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Unable to generate the weekly plan."));
      const payload: unknown = await response.json();
      if (!isRecord(payload)) throw new Error("The generated plan response was invalid.");

      if (action === "week") {
        const days = weeklyPlanScheduleSchema.parse(payload.days);
        const draftId = createDraftPlanKey();
        const freshGroceryState: WeeklyPlanGroceryState = { checked: [], custom: [] };
        setGroceryStateByKey((prev) => ({ ...prev, [draftId]: freshGroceryState }));
        setCurrent({
          draftId,
          name: planName.trim() || nextDefaultPlanName(plans),
          preferences,
          days,
          isActive: true,
          groceryState: freshGroceryState,
        });
        setActiveSection("schedule");
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

  function updateCurrentGroceryState(nextState: WeeklyPlanGroceryState) {
    if (!current) return;
    const planKey = getPlanGroceryKey(current);
    const savedLocal = savePlanGroceryState(planKey, nextState);

    setGroceryStateByKey((prev) => ({ ...prev, [planKey]: savedLocal }));
    setCurrent((prev) => (prev ? { ...prev, groceryState: savedLocal } : prev));

    if (!current.id) return;
    const targetId = current.id;
    setPlans((existing) =>
      existing.map((plan) => (plan.id === targetId ? { ...plan, groceryState: savedLocal } : plan)),
    );

    const pending = grocerySyncTimersRef.current.get(targetId);
    if (pending !== undefined) window.clearTimeout(pending);

    const timerId = window.setTimeout(() => {
      grocerySyncTimersRef.current.delete(targetId);
      void fetch(`/api/weekly-plans/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groceryState: savedLocal }),
      }).catch(() => {});
    }, 350);
    grocerySyncTimersRef.current.set(targetId, timerId);
  }

  async function savePlan() {
    if (!current) return;
    setError(null);
    setNotice(null);
    setIsSaving(true);
    setIsRenaming(false);
    try {
      const preferences = weeklyPlanRecordSchema.shape.preferences.parse(current.preferences);
      const days = weeklyPlanScheduleSchema.parse(current.days);
      const activeKey = getPlanGroceryKey(current);
      const groceryState = groceryStateByKey[activeKey] ?? current.groceryState ?? EMPTY_GROCERY_STATE;

      if (current.id) {
        const pending = grocerySyncTimersRef.current.get(current.id);
        if (pending !== undefined) {
          window.clearTimeout(pending);
          grocerySyncTimersRef.current.delete(current.id);
        }
      }

      const body = {
        name: planName.trim() || "My Weekly Plan",
        preferences,
        days,
        groceryState,
        ...(current.id ? {} : { isActive: true }),
      };
      const response = await fetch(current.id ? `/api/weekly-plans/${current.id}` : "/api/weekly-plans", {
        method: current.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await responseError(response, "Unable to save this weekly plan."));
      const payload: unknown = await response.json();
      const saved = weeklyPlanRecordSchema.parse(isRecord(payload) ? payload.plan : undefined);

      let resolvedGroceryState = saved.groceryState ?? groceryState;
      const savedKey = getPlanGroceryKey(saved);
      if (!current.id && current.draftId) {
        const oldDraftId = current.draftId;
        resolvedGroceryState = migrateDraftGroceryState(oldDraftId, saved.id, resolvedGroceryState);
        setGroceryStateByKey((prev) => {
          const next = { ...prev };
          delete next[oldDraftId];
          next[savedKey] = resolvedGroceryState;
          return next;
        });
      } else {
        const persisted = savePlanGroceryState(savedKey, resolvedGroceryState);
        resolvedGroceryState = persisted;
        setGroceryStateByKey((prev) => ({ ...prev, [savedKey]: persisted }));
      }

      const savedWithGrocery: WeeklyPlan = {
        ...saved,
        groceryState: resolvedGroceryState,
      };
      setCurrent(savedWithGrocery);
      setPlans((existing) => [
        savedWithGrocery,
        ...existing
          .filter((plan) => plan.id !== savedWithGrocery.id)
          .map((plan) => (savedWithGrocery.isActive ? { ...plan, isActive: false } : plan)),
      ]);
      setPlanName(savedWithGrocery.name);
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

      const pending = grocerySyncTimersRef.current.get(plan.id);
      if (pending !== undefined) {
        window.clearTimeout(pending);
        grocerySyncTimersRef.current.delete(plan.id);
      }
      const deletedKey = getPlanGroceryKey(plan);
      removePlanGroceryState(deletedKey, plan.id);
      setGroceryStateByKey((prev) => {
        const next = { ...prev };
        delete next[deletedKey];
        return next;
      });

      const remaining = plans.filter((item) => item.id !== plan.id);
      setPlans(remaining);
      if (current?.id === plan.id) {
        if (remaining[0]) openPlan(remaining[0], activeSection === "saved" ? "keep" : "schedule");
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
  const isBusy = isGenerating !== null || isSaving || isDeleting !== null || isSettingActiveId !== null;
  const currentPlanKey = current ? getPlanGroceryKey(current) : "draft-ephemeral";
  const currentGroceryState =
    groceryStateByKey[currentPlanKey] ??
    current?.groceryState ??
    EMPTY_GROCERY_STATE;
  const parsedSchedule = current ? weeklyPlanScheduleSchema.safeParse(current.days) : null;
  const summary = parsedSchedule?.success ? computeWeeklySummary(parsedSchedule.data) : null;
  const groceryCount = parsedSchedule?.success
    ? countWeeklyGroceryItems(parsedSchedule.data, currentGroceryState.custom)
    : 0;
  const groceryPlanOptions: GroceryPlanOption[] = plans.map((plan) => {
    const key = getPlanGroceryKey(plan);
    const customItems = (groceryStateByKey[key] ?? plan.groceryState ?? EMPTY_GROCERY_STATE).custom;
    const parsed = weeklyPlanScheduleSchema.safeParse(plan.days);
    return {
      id: plan.id,
      name: plan.name,
      itemCount: parsed.success ? countWeeklyGroceryItems(parsed.data, customItems) : 0,
      isActive: plan.isActive,
      isSelected: current?.id === plan.id,
    };
  });
  const avgCalPercent =
    summary && current?.preferences.dailyCalorieTarget
      ? Math.round((summary.avgDailyCalories / current.preferences.dailyCalorieTarget) * 100)
      : 0;

  if (isLoading && !current && !isCreating) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-12 w-full rounded-xl bg-[var(--surface-muted)]" />
        <div className="h-16 w-full rounded-2xl bg-[var(--surface-muted)]" />
        <div className="h-96 w-full rounded-2xl bg-[var(--surface-muted)]" />
      </div>
    );
  }

  return (
    <section className="space-y-5">
      {/* Sleek Boxless Top Command Strip (shown only when viewing or creating a plan) */}
      {(current || isCreating) && (
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            {current && !isCreating ? (
              isRenaming ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label="Plan name"
                    value={planName}
                    onChange={(event) => {
                      setPlanName(event.target.value);
                      setIsDirty(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === "Escape") {
                        event.preventDefault();
                        setIsRenaming(false);
                      }
                    }}
                    autoFocus
                    maxLength={100}
                    disabled={isBusy}
                    className="h-11 min-w-[200px] flex-1 rounded-xl border border-[var(--leaf)] bg-[var(--surface)] px-3 text-sm font-semibold outline-none sm:max-w-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setIsRenaming(false)}
                    className="active-press min-h-11 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3.5 text-xs font-bold text-[var(--foreground)] hover:border-[var(--leaf)]"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl">
                      {planName.trim() || current.name}
                    </h2>
                    {current.isActive ? (
                      <span className="rounded-full bg-[var(--leaf-light)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--leaf-ink)]">
                        Active
                      </span>
                    ) : current.id ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          if (current.id) void setActivePlan(current.id);
                        }}
                        className="active-press min-h-11 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 text-[11px] font-bold text-[var(--foreground)] hover:border-[var(--leaf)] disabled:opacity-50"
                      >
                        {isSettingActiveId === current.id ? "Activating…" : "Set active"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Rename plan"
                      disabled={isBusy}
                      onClick={() => setIsRenaming(true)}
                      className="active-press inline-flex min-h-11 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-[var(--ink-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-50"
                    >
                      <IconEdit className="size-3.5" />
                      <span className="sr-only sm:not-sr-only">Rename</span>
                    </button>
                  </div>
                  <p className="tabular-nums mt-0.5 text-xs text-[var(--ink-muted)]">
                    {current.preferences.dailyCalorieTarget.toLocaleString()} kcal/day · {current.preferences.mealsPerDay} meals
                  </p>
                </div>
              )
            ) : (
              <div>
                <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl">
                  Create Weekly Plan
                </h2>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                  Set your calorie target, meal frequency, and food preferences.
                </p>
              </div>
            )}
          </div>

          <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
            {current && !isCreating && (
              <>
                <div
                  role="tablist"
                  aria-label="Weekly plan sections"
                  className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-2xs sm:inline-flex sm:w-auto"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeSection === "schedule"}
                    onClick={() => setActiveSection("schedule")}
                    className={`active-press inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-[11px] font-bold transition-colors sm:px-3.5 sm:text-xs ${
                      activeSection === "schedule"
                        ? "bg-[var(--leaf-light)] text-[var(--leaf-ink)]"
                        : "text-[var(--ink-muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <IconCalendar className="hidden size-3.5 shrink-0 sm:block" />
                    <span>Schedule</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeSection === "grocery"}
                    onClick={() => setActiveSection("grocery")}
                    className={`active-press inline-flex min-h-11 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1.5 text-[11px] font-bold transition-colors sm:gap-1.5 sm:px-3.5 sm:text-xs ${
                      activeSection === "grocery"
                        ? "bg-[var(--leaf-light)] text-[var(--leaf-ink)]"
                        : "text-[var(--ink-muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <IconShoppingBag className="size-3.5 shrink-0" />
                    <span>Grocery</span>
                    {groceryCount > 0 && (
                      <span className="tabular-nums rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--foreground)]">
                        {groceryCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeSection === "saved"}
                    onClick={() => setActiveSection("saved")}
                    className={`active-press inline-flex min-h-11 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1.5 text-[11px] font-bold transition-colors sm:gap-1.5 sm:px-3.5 sm:text-xs ${
                      activeSection === "saved"
                        ? "bg-[var(--leaf-light)] text-[var(--leaf-ink)]"
                        : "text-[var(--ink-muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <IconMealPlans className="size-3.5 shrink-0" />
                    <span className="sm:hidden">Saved</span>
                    <span className="hidden sm:inline">Saved Plans</span>
                    {plans.length > 0 && (
                      <span className="tabular-nums rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--foreground)]">
                        {plans.length}
                      </span>
                    )}
                  </button>
                </div>

                {(isDirty || !current.id) && (
                  <button
                    type="button"
                    disabled={isSaving || isGenerating !== null}
                    onClick={() => void savePlan()}
                    className="active-press min-h-11 rounded-xl bg-[var(--leaf)] px-4 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
                  >
                    {isSaving ? "Saving…" : current.id ? "Save changes" : "Save plan"}
                  </button>
                )}

                {activeSection !== "saved" && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={startNewPlan}
                    className="active-press inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3.5 text-xs font-bold text-[var(--foreground)] transition-colors hover:border-[var(--leaf)] hover:text-[var(--leaf)] disabled:opacity-50"
                  >
                    <IconPlus className="size-3.5" />
                    <span>New Plan</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

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

      {/* Create New Plan Form */}
      {isCreating && (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)]" htmlFor="wp-name">Plan name</label>
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
              <label className="block text-sm font-semibold text-[var(--foreground)]" htmlFor="wp-calories">Daily calorie target</label>
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
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CALORIE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isBusy}
                    onClick={() => setCalorieTarget(String(preset))}
                    className={`active-press min-h-11 rounded-xl border px-3 text-xs font-bold transition-colors ${
                      Number(calorieTarget) === preset
                        ? "border-[var(--leaf)] bg-[var(--leaf-light)] text-[var(--leaf-ink)]"
                        : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink-muted)] hover:border-[var(--leaf)]"
                    }`}
                  >
                    {preset.toLocaleString()} kcal
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-sm font-semibold text-[var(--foreground)]" id="wp-meals-label">
                Meals per day
              </span>
              <div
                role="group"
                aria-labelledby="wp-meals-label"
                className="mt-2 grid grid-cols-5 gap-1.5"
              >
                {MEALS_PER_DAY_OPTIONS.map((count) => {
                  const selected = Number(mealsPerDay) === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      aria-pressed={selected}
                      disabled={isBusy}
                      onClick={() => setMealsPerDay(String(count))}
                      className={`active-press min-h-11 rounded-xl border text-xs font-bold transition-colors ${
                        selected
                          ? "border-[var(--leaf)] bg-[var(--leaf)] text-[var(--on-leaf)]"
                          : "border-[var(--border-control)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--leaf)]"
                      }`}
                    >
                      {count}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)]" htmlFor="wp-preferred">Preferred foods</label>
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
              <label className="block text-sm font-semibold text-[var(--foreground)]" htmlFor="wp-restrictions">Food restrictions</label>
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

          <div className="mt-6 flex flex-wrap gap-3">
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
              onClick={() => {
                setIsCreating(false);
                const restore = plans.find((plan) => plan.isActive) ?? plans[0];
                if (restore) openPlan(restore);
              }}
              className="active-press min-h-12 rounded-xl border border-[var(--border-control)] px-5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Empty State */}
      {newPlan && !isCreating && !error && (
        <section className="mx-auto max-w-xl rounded-[2rem] border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-2xs sm:p-10">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--leaf-light)] text-[var(--leaf)]">
            <IconCalendar className="size-6" />
          </div>
          <h2 className="mt-4 text-lg font-bold tracking-tight text-[var(--foreground)]">
            No weekly plan yet
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-[var(--ink-muted)]">
            Generate a personalized 7-day meal schedule and automatic grocery checklist tailored to your daily calorie target.
          </p>
          <button
            type="button"
            onClick={startNewPlan}
            className="active-press mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--leaf)] px-6 text-sm font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)]"
          >
            <IconPlus className="size-4" />
            <span>Create Weekly Plan</span>
          </button>
        </section>
      )}

      {/* Full-Width Primary Workspace (3-Tab Hierarchy: Schedule / Grocery / Saved Plans) */}
      {current && !isCreating && activeSection === "schedule" && (
        <div className="space-y-4">
          {summary && (
            <section
              aria-label="Weekly nutrition average"
              className={`flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs lg:grid lg:items-center lg:gap-6 ${
                current.preferences.preferredFoods.length > 0 || current.preferences.foodRestrictions.length > 0
                  ? "lg:grid-cols-[minmax(210px,260px)_auto_1fr]"
                  : "lg:grid-cols-[minmax(210px,280px)_1fr]"
              }`}
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                    Weekly Average
                  </h3>
                  <span className="tabular-nums text-xs font-extrabold text-[var(--foreground)]">
                    {summary.avgDailyCalories.toLocaleString()}
                    <span className="font-normal text-[var(--ink-muted)]">
                      {" "}/ {current.preferences.dailyCalorieTarget.toLocaleString()} kcal
                    </span>
                  </span>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div
                    className={`h-full w-full origin-left rounded-full transition-transform duration-300 ${
                      avgCalPercent > 105 ? "bg-[var(--coral)]" : "bg-[var(--leaf)]"
                    }`}
                    style={{ transform: `scaleX(${Math.min(avgCalPercent, 100) / 100})` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-[var(--line)]/60 pt-2.5 text-xs lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
                <div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-muted)]">
                    <span className="size-2 rounded-full bg-[var(--macro-protein)]" aria-hidden="true" />
                    Protein
                  </span>
                  <p className="tabular-nums font-bold text-[var(--foreground)]">{summary.avgDailyProteinG}g</p>
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-muted)]">
                    <span className="size-2 rounded-full bg-[var(--macro-carbs)]" aria-hidden="true" />
                    Carbs
                  </span>
                  <p className="tabular-nums font-bold text-[var(--foreground)]">{summary.avgDailyCarbsG}g</p>
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-muted)]">
                    <span className="size-2 rounded-full bg-[var(--macro-fat)]" aria-hidden="true" />
                    Fat
                  </span>
                  <p className="tabular-nums font-bold text-[var(--foreground)]">{summary.avgDailyFatG}g</p>
                </div>
              </div>

              {(current.preferences.preferredFoods.length > 0 || current.preferences.foodRestrictions.length > 0) && (
                <div className="flex flex-wrap gap-1.5 border-t border-[var(--line)]/60 pt-2.5 text-[11px] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
                  {current.preferences.preferredFoods.length > 0 && (
                    <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[var(--ink-muted)]">
                      Likes: {current.preferences.preferredFoods.join(", ")}
                    </span>
                  )}
                  {current.preferences.foodRestrictions.length > 0 && (
                    <span className="rounded-md bg-[var(--coral-soft)] px-2 py-0.5 font-semibold text-[var(--coral)]">
                      Avoids: {current.preferences.foodRestrictions.join(", ")}
                    </span>
                  )}
                </div>
              )}
            </section>
          )}

          <WeeklyDayView
            days={current.days}
            dailyCalorieTarget={current.preferences.dailyCalorieTarget}
            todayName={todayName}
            selectedDayName={selectedDay}
            isGenerating={isGenerating}
            isBusy={isBusy}
            loggingMealKey={loggingMealKey}
            savingRecipeTitle={savingRecipeTitle}
            onSelectDay={(dayName) => setSelectedDay(dayName)}
            onUpdateServings={updateServings}
            onLogToday={(dayName, slotLabel, meal) => void logMealToday(dayName, slotLabel, meal)}
            onSaveRecipe={(meal) => void saveMealAsRecipe(meal)}
            onReplaceMeal={(dayName, slotLabel, currentTitle) =>
              void generate("meal", { day: dayName, slot: slotLabel, currentTitle })
            }
            onRegenerateDay={(dayName) => void generate("day", { day: dayName })}
          />

          <p className="text-[11px] leading-5 text-[var(--ink-muted)]">
            Nutrition values are AI-generated estimates per serving; adjust servings to update totals. Verify ingredients if you have allergies.
          </p>
        </div>
      )}

      {current && !isCreating && activeSection === "grocery" && (
        <WeeklyGroceryList
          key={currentPlanKey}
          planKey={currentPlanKey}
          planName={planName}
          days={current.days}
          groceryState={currentGroceryState}
          onChangeGroceryState={updateCurrentGroceryState}
          planOptions={groceryPlanOptions}
          onSelectPlan={(planId) => {
            const target = plans.find((item) => item.id === planId);
            if (target) openPlan(target, "grocery");
          }}
        />
      )}

      {current && !isCreating && activeSection === "saved" && (
        <section aria-label="Saved weekly plans" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold tracking-tight text-[var(--foreground)]">
                Saved Weekly Plans
              </h3>
              <span className="tabular-nums rounded-full bg-[var(--surface-muted)] px-2.5 py-0.5 text-xs font-bold text-[var(--ink-muted)]">
                {plans.length}
              </span>
            </div>

            <button
              type="button"
              disabled={isBusy}
              onClick={startNewPlan}
              className="active-press inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[var(--leaf)] px-4 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
            >
              <IconPlus className="size-3.5" />
              <span>New Plan</span>
            </button>
          </div>

          {plans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center">
              <p className="text-sm text-[var(--ink-muted)]">No saved weekly plans yet.</p>
              <button
                type="button"
                onClick={() => (current && !current.id ? void savePlan() : startNewPlan())}
                className="active-press mt-4 min-h-11 rounded-xl bg-[var(--leaf)] px-4 text-xs font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)]"
              >
                {current && !current.id ? "Save current plan" : "Create your first plan"}
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const isSelected = current?.id === plan.id;
                const parsedPlanSchedule = weeklyPlanScheduleSchema.safeParse(plan.days);
                const planAvgCalories = parsedPlanSchedule.success
                  ? computeWeeklySummary(parsedPlanSchedule.data).avgDailyCalories
                  : null;
                const planKey = getPlanGroceryKey(plan);
                const planGroceryState = groceryStateByKey[planKey] ?? plan.groceryState ?? EMPTY_GROCERY_STATE;
                const planGroceryCount = parsedPlanSchedule.success
                  ? countWeeklyGroceryItems(parsedPlanSchedule.data, planGroceryState.custom)
                  : 0;
                return (
                  <article
                    key={plan.id}
                    className={`flex flex-col justify-between gap-4 rounded-2xl border p-4 shadow-xs transition-colors ${
                      isSelected
                        ? "border-[var(--leaf)]/50 bg-[var(--leaf-light)]/25"
                        : "border-[var(--line)] bg-[var(--surface)]"
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      disabled={isBusy}
                      onClick={() => openPlan(plan, "keep")}
                      className="active-press w-full space-y-1.5 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--leaf)] disabled:opacity-60"
                    >
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="block min-w-0 flex-1 truncate text-sm font-bold text-[var(--foreground)]">
                          {plan.name}
                        </span>
                        {plan.isActive && (
                          <span className="shrink-0 rounded-full bg-[var(--leaf)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--on-leaf)]">
                            Active
                          </span>
                        )}
                        {isSelected && (
                          <span className="shrink-0 rounded-full border border-[var(--leaf)]/40 bg-[var(--leaf-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--leaf-ink)]">
                            Viewing
                          </span>
                        )}
                      </span>

                      <span className="tabular-nums block text-xs text-[var(--ink-muted)]">
                        {plan.preferences.dailyCalorieTarget.toLocaleString()} kcal/day · {plan.preferences.mealsPerDay} meals
                        {planAvgCalories !== null ? ` · Avg ${planAvgCalories.toLocaleString()} kcal` : ""}
                        {` · ${planGroceryCount} ${planGroceryCount === 1 ? "grocery item" : "grocery items"}`}
                      </span>
                    </button>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)]/60 pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => openPlan(plan, "schedule")}
                          className="active-press inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3.5 text-xs font-bold text-[var(--foreground)] transition-colors hover:border-[var(--leaf)] hover:text-[var(--leaf-ink)] disabled:opacity-50"
                        >
                          Schedule
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => openPlan(plan, "grocery")}
                          className="active-press inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--leaf)] hover:text-[var(--foreground)] disabled:opacity-50"
                        >
                          <IconShoppingBag className="size-3.5" />
                          <span>Grocery</span>
                          <span className="tabular-nums rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--foreground)]">
                            {planGroceryCount}
                          </span>
                        </button>
                        {!plan.isActive && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void setActivePlan(plan.id)}
                            className="active-press inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--leaf)] hover:text-[var(--foreground)] disabled:opacity-50"
                          >
                            {isSettingActiveId === plan.id ? "Activating…" : "Set active"}
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        aria-label={`Delete ${plan.name}`}
                        disabled={isBusy}
                        onClick={() => setPlanToDelete(plan)}
                        className="active-press grid size-11 shrink-0 place-items-center rounded-xl text-[var(--ink-muted)] transition-colors hover:bg-[var(--coral-soft)] hover:text-[var(--coral)] disabled:opacity-50"
                      >
                        {isDeleting === plan.id ? "…" : <IconTrash className="size-4" />}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {current && !isCreating && isDirty && (
        <div className="sticky bottom-20 z-20 flex items-center justify-between gap-3 rounded-2xl border border-[var(--leaf)] bg-[var(--surface)]/95 px-4 py-3 shadow-lg backdrop-blur-md md:bottom-4">
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
