"use client";

import { useEffect, useState } from "react";
import type { NutrientRate } from "@/lib/types";

type CustomFood = { id: number; food_name: string; default_weight_g: number; calories_per_g: number; protein_per_g: number; carbs_per_g: number; fat_per_g: number; fiber_per_g: number; sodium_per_g: number; sugar_per_g: number };
type PlanItem = { foodName: string; weightG: number; nutrientRate: NutrientRate };

export default function CustomFoodPicker({ onSelect }: { onSelect: (item: PlanItem) => void }) {
  const [foods, setFoods] = useState<CustomFood[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/custom-foods");
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to load custom foods.");
        return;
      }
      setFoods(payload.foods ?? []);
    };
    void load();
  }, []);

  return <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"><p className="font-semibold">Saved custom foods</p>{error && <p className="mt-2 text-sm text-[var(--coral)]" role="alert">{error}</p>}{foods.length === 0 ? <p className="mt-2 text-xs text-[var(--ink-muted)]">Custom foods saved from label-based logging will appear here.</p> : <div className="mt-3 space-y-2">{foods.map((food) => <button className="flex w-full items-center justify-between rounded-xl bg-[var(--surface-muted)] p-3 text-left hover:border-[var(--leaf)]" key={food.id} onClick={() => onSelect({ foodName: food.food_name, weightG: Number(food.default_weight_g), nutrientRate: { caloriesPerG: Number(food.calories_per_g), proteinPerG: Number(food.protein_per_g), carbsPerG: Number(food.carbs_per_g), fatPerG: Number(food.fat_per_g), fiberPerG: Number(food.fiber_per_g), sodiumPerG: Number(food.sodium_per_g), sugarPerG: Number(food.sugar_per_g) } })} type="button"><span className="font-medium">{food.food_name}</span><span className="text-xs text-[var(--ink-muted)]">{food.default_weight_g}g · {Number(food.calories_per_g).toFixed(2)} cal/g</span></button>)}</div>}</div>;
}
