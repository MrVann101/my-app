"use client";

import { useState } from "react";
import { IconBookmark, IconPlus, IconRefresh, IconSwap } from "@/components/icons";
import {
  computeDayTotals,
  computeMealTotals,
  getMealSlotLabel,
  isGenericSlotTitle,
  type WeeklyPlanDay,
  type WeeklyPlanMeal,
} from "@/lib/weekly-plan-schemas";
import { MealSlotIcon, ServingsStepper } from "./meal-controls";

type WeeklyDayViewProps = {
  days: WeeklyPlanDay[];
  dailyCalorieTarget: number;
  todayName: string;
  selectedDayName: WeeklyPlanDay["day"];
  isGenerating: string | null;
  isBusy: boolean;
  loggingMealKey: string | null;
  savingRecipeTitle: string | null;
  onSelectDay: (dayName: WeeklyPlanDay["day"]) => void;
  onUpdateServings: (dayName: string, mealIndex: number, nextServings: number) => void;
  onLogToday: (dayName: string, slotLabel: string, meal: WeeklyPlanMeal) => void;
  onSaveRecipe: (meal: WeeklyPlanMeal) => void;
  onReplaceMeal: (dayName: string, slotLabel: string, currentTitle: string) => void;
  onRegenerateDay: (dayName: string) => void;
};

export default function WeeklyDayView({
  days,
  dailyCalorieTarget,
  todayName,
  selectedDayName,
  isGenerating,
  isBusy,
  loggingMealKey,
  savingRecipeTitle,
  onSelectDay,
  onUpdateServings,
  onLogToday,
  onSaveRecipe,
  onReplaceMeal,
  onRegenerateDay,
}: WeeklyDayViewProps) {
  const [showAllDays, setShowAllDays] = useState(false);

  const visibleDays = showAllDays
    ? days
    : days.filter((day) => day.day === selectedDayName);

  const targetCalories = dailyCalorieTarget || 2000;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
          Choose a day
        </p>
        <button
          type="button"
          aria-pressed={showAllDays}
          onClick={() => setShowAllDays((all) => !all)}
          className="active-press inline-flex min-h-11 items-center rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3.5 text-xs font-bold text-[var(--foreground)] hover:border-[var(--leaf)]"
        >
          {showAllDays ? "Single day focus" : "Show all 7 days"}
        </button>
      </div>

      {/* 7-Day Overview Pill Strip */}
      <div
        role="tablist"
        aria-label="Days of the week"
        className="flex gap-1.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-7"
      >
        {days.map((day) => {
          const totals = computeDayTotals(day);
          const calPercent = Math.round((totals.calories / targetCalories) * 100);
          const isSelected = !showAllDays && day.day === selectedDayName;
          const isToday = day.day === todayName;
          const isOver = calPercent > 105;

          return (
            <button
              key={day.day}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-label={`${day.day}${isToday ? " (Today)" : ""}, ${totals.calories} calories`}
              onClick={() => {
                setShowAllDays(false);
                onSelectDay(day.day);
              }}
              className={`active-press flex min-h-[58px] min-w-[58px] shrink-0 flex-col justify-between rounded-xl border p-2 text-left transition-colors sm:min-w-0 ${
                isSelected
                  ? "border-[var(--leaf)] bg-[var(--leaf)] text-[var(--on-leaf)] shadow-xs"
                  : isToday
                    ? "border-[var(--leaf)]/50 bg-[var(--leaf-light)]/50 text-[var(--foreground)] hover:border-[var(--leaf)]"
                    : "border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--leaf)]"
              }`}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <span className="text-[11px] font-bold">{day.day.slice(0, 3)}</span>
                {isToday && (
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${isSelected ? "bg-[var(--on-leaf)]" : "bg-[var(--leaf)]"}`}
                  />
                )}
              </div>

              <span
                className={`tabular-nums text-[11px] font-bold ${
                  isSelected ? "text-[var(--on-leaf)]" : "text-[var(--ink-muted)]"
                }`}
              >
                {totals.calories.toLocaleString()}
              </span>

              <div
                className={`mt-1 h-1 w-full overflow-hidden rounded-full ${
                  isSelected ? "bg-black/20" : "bg-[var(--surface-muted)]"
                }`}
              >
                <div
                  className={`h-full rounded-full ${
                    isSelected
                      ? "bg-[var(--on-leaf)]"
                      : isOver
                        ? "bg-[var(--coral)]"
                        : "bg-[var(--leaf)]"
                  }`}
                  style={{ width: `${Math.min(calPercent, 100)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Focused Day(s) */}
      <div className="space-y-4">
        {visibleDays.map((day) => {
          const dayTotals = computeDayTotals(day);
          const calPercent = Math.round((dayTotals.calories / targetCalories) * 100);
          const isToday = day.day === todayName;
          const isOver = calPercent > 105;

          return (
            <article
              key={day.day}
              className={`overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-xs ${
                isToday ? "border-[var(--leaf)] ring-1 ring-[var(--leaf)]/30" : "border-[var(--line)]"
              }`}
            >
              <header className="border-b border-[var(--line)] bg-[var(--surface-muted)]/70 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[var(--foreground)]">{day.day}</h3>
                    {isToday && (
                      <span className="rounded-full bg-[var(--leaf)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--on-leaf)]">
                        Today
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onRegenerateDay(day.day)}
                    className="active-press inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3.5 text-xs font-bold text-[var(--leaf-ink)] hover:border-[var(--leaf)] disabled:opacity-50"
                  >
                    <IconRefresh className="size-3.5" />
                    <span>{isGenerating === `day-${day.day}-` ? "Regenerating..." : "Regenerate day"}</span>
                  </button>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="tabular-nums font-semibold text-[var(--ink-muted)]">
                      {dayTotals.calories.toLocaleString()} / {targetCalories.toLocaleString()} kcal
                    </span>
                    <span className={`tabular-nums font-bold ${isOver ? "text-[var(--coral)]" : "text-[var(--leaf)]"}`}>
                      {calPercent}% target
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]/60">
                    <div
                      className={`h-full w-full origin-left rounded-full transition-transform duration-300 ${
                        isOver ? "bg-[var(--coral)]" : "bg-[var(--leaf)]"
                      }`}
                      style={{ transform: `scaleX(${Math.min(calPercent, 100) / 100})` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="tabular-nums inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--foreground)]">
                    <span className="size-2 rounded-full bg-[var(--macro-protein)]" aria-hidden="true" />
                    Protein {dayTotals.proteinG}g
                  </span>
                  <span className="tabular-nums inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--foreground)]">
                    <span className="size-2 rounded-full bg-[var(--macro-carbs)]" aria-hidden="true" />
                    Carbs {dayTotals.carbsG}g
                  </span>
                  <span className="tabular-nums inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--foreground)]">
                    <span className="size-2 rounded-full bg-[var(--macro-fat)]" aria-hidden="true" />
                    Fat {dayTotals.fatG}g
                  </span>
                </div>
              </header>

              <div className={!showAllDays ? "grid gap-3 p-3.5 sm:p-5 md:grid-cols-2" : "divide-y divide-[var(--line)]/70"}>
                {day.meals.map((meal, index) => {
                  const slot = getMealSlotLabel(day.meals.length, index);
                  const totals = computeMealTotals(meal);
                  const isReplacing = isGenerating === `meal-${day.day}-${slot}`;
                  const isSavingRecipe = savingRecipeTitle === meal.title;
                  const isLoggingToday = loggingMealKey === `${day.day}-${slot}`;
                  const hasGenericTitle = isGenericSlotTitle(meal.title);

                  return (
                    <div
                      key={`${day.day}-${slot}`}
                      className={
                        !showAllDays
                          ? "flex flex-col justify-between gap-3.5 rounded-2xl border border-[var(--line)] bg-[var(--background)]/45 p-4"
                          : "space-y-3 p-4 sm:p-5"
                      }
                    >
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--leaf)]">
                            <MealSlotIcon slotLabel={slot} className="size-3.5" />
                            <span>{slot}</span>
                          </div>
                          <div className="tabular-nums flex items-center gap-2 text-xs">
                            <span className="font-extrabold text-[var(--foreground)]">{totals.calories} kcal</span>
                            <span className="text-[var(--ink-muted)]">
                              P{totals.proteinG} · C{totals.carbsG} · F{totals.fatG}
                            </span>
                          </div>
                        </div>

                        <div>
                          {hasGenericTitle ? (
                            <>
                              <h4 className="text-sm font-bold text-[var(--ink-muted)] sm:text-base">
                                {slot} recipe suggestion needed
                              </h4>
                              <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                                Tap Replace to generate a named dish, short description, and grocery ingredients.
                              </p>
                            </>
                          ) : (
                            <>
                              <h4 className="text-sm font-bold leading-snug text-[var(--foreground)] sm:text-base">
                                {meal.title}
                              </h4>
                              <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                                {meal.description}
                              </p>
                              {meal.ingredients && meal.ingredients.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {meal.ingredients.slice(0, 4).map((ingredient) => (
                                    <span
                                      key={ingredient}
                                      className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]"
                                    >
                                      {ingredient}
                                    </span>
                                  ))}
                                  {meal.ingredients.length > 4 && (
                                    <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]">
                                      +{meal.ingredients.length - 4}
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--line)]/60 pt-3">
                        <ServingsStepper
                          labelContext={`${day.day} ${slot}`}
                          servings={meal.servings}
                          disabled={isBusy}
                          onChange={(nextServings) => onUpdateServings(day.day, index, nextServings)}
                        />

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isLoggingToday || isBusy}
                            onClick={() => onLogToday(day.day, slot, meal)}
                            className="active-press inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--leaf)] px-3 text-xs font-bold text-[var(--on-leaf)] shadow-xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
                          >
                            <IconPlus className="size-3.5" />
                            <span>{isLoggingToday ? "Logging..." : "Log today"}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isSavingRecipe || isBusy}
                            onClick={() => onSaveRecipe(meal)}
                            title="Save this meal into My Plans"
                            className="active-press inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--leaf)] hover:text-[var(--leaf)] disabled:opacity-50"
                          >
                            <IconBookmark className="size-3.5" />
                            <span>{isSavingRecipe ? "Saving..." : "Save"}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onReplaceMeal(day.day, slot, meal.title)}
                            className="active-press inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--leaf)] hover:text-[var(--leaf)] disabled:opacity-50"
                          >
                            <IconSwap className="size-3.5" />
                            <span>{isReplacing ? "Replacing..." : "Replace"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
