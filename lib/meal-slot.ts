export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_SLOTS: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export function normalizeMealSlot(value?: string | null): MealSlot | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "snacks") return "snack";
  if (normalized === "breakfast" || normalized === "lunch" || normalized === "dinner" || normalized === "snack") {
    return normalized;
  }
  return null;
}

export function defaultMealTypeByHour(date: Date = new Date()): MealSlot {
  const hour = date.getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}
