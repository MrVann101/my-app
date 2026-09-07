export type WeeklySummary = {
  daysTracked: number;
  averageCalories: number;
  averageNetCalories: number;
  averageProteinG: number;
  totalExerciseCalories: number;
  targetHitDays: number;
  summary: string;
};

export function buildWeeklySummary(rows: Array<{ total_calories: number; calories_burned: number; total_protein_g: number; hit_target: boolean; logged_at_least_once: boolean }>): WeeklySummary {
  const tracked = rows.filter((row) => row.logged_at_least_once || Number(row.total_calories) > 0);
  const count = tracked.length;
  const averageCalories = count ? tracked.reduce((sum, row) => sum + Number(row.total_calories), 0) / count : 0;
  const totalExerciseCalories = tracked.reduce((sum, row) => sum + Number(row.calories_burned), 0);
  const averageNetCalories = count ? tracked.reduce((sum, row) => sum + Number(row.total_calories) - Number(row.calories_burned), 0) / count : 0;
  const averageProteinG = count ? tracked.reduce((sum, row) => sum + Number(row.total_protein_g), 0) / count : 0;
  const targetHitDays = tracked.filter((row) => row.hit_target).length;
  const summary = count === 0
    ? "No logged days yet. Add a few meals to build your weekly summary."
    : `${count} logged day${count === 1 ? "" : "s"}, averaging ${Math.round(averageCalories)} kcal and ${Math.round(averageProteinG)}g protein. You recorded ${Math.round(totalExerciseCalories)} exercise kcal and met your target on ${targetHitDays} day${targetHitDays === 1 ? "" : "s"}.`;
  return { daysTracked: count, averageCalories, averageNetCalories, averageProteinG, totalExerciseCalories, targetHitDays, summary };
}
