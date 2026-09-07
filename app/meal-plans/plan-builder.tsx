"use client";

import { FormEvent, useState } from "react";
import AiItemPicker from "@/app/meal-plans/ai-item-picker";
import CustomFoodPicker from "@/app/meal-plans/custom-food-picker";
import FoodSearch, { SearchResult } from "@/app/log/food-search";
import type { NutrientRate } from "@/lib/types";

const emptyRate: NutrientRate = { caloriesPerG: 0, proteinPerG: 0, carbsPerG: 0, fatPerG: 0, fiberPerG: 0, sodiumPerG: 0, sugarPerG: 0 };
type PlanItem = { foodName: string; weightG: number; nutrientRate: NutrientRate };

export default function PlanBuilder() {
    const [name, setName] = useState("");
    const [foodName, setFoodName] = useState("");
    const [weight, setWeight] = useState("100");
    const [calories, setCalories] = useState("");
    const [selectedFood, setSelectedFood] = useState<SearchResult | null>(null);
    const [items, setItems] = useState<PlanItem[]>([]);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    function addItem(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const itemName = selectedFood?.foodName ?? foodName.trim();
      const weightG = Number(weight);
      const caloriesPerG = Number(calories);
      if (!itemName || !Number.isFinite(weightG) || weightG <= 0) return;
      if (!selectedFood && (!Number.isFinite(caloriesPerG) || caloriesPerG < 0)) return;
      setItems([...items, { foodName: itemName, weightG, nutrientRate: selectedFood?.nutrientRate ?? { ...emptyRate, caloriesPerG } }]);
      setFoodName("");
      setCalories("");
      setSelectedFood(null);
    }

    function addAiItem(item: PlanItem) {
      setItems([...items, item]);
    }

    async function savePlan() {
      setError(null);
      const response = await fetch("/api/meal-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, visibility: "private", goal: null, dietType: null, items }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to save meal plan.");
        return;
      }
      setMessage(`Saved ${payload.plan.name} without changing today's totals.`);
    }

    const total = items.reduce((sum, item) => sum + item.weightG * item.nutrientRate.caloriesPerG, 0);

    return (
      <div className="space-y-5">
        <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
          <label className="block text-sm font-medium">Plan name
            <input className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3" value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <div className="mt-5">
            <p className="mb-2 text-sm font-medium">Choose a database food</p>
            <FoodSearch onSelect={setSelectedFood} />
          </div>
          <div className="mt-5 border-t border-[var(--line)] pt-5">
            <AiItemPicker onSelect={addAiItem} />
          </div>
          <div className="mt-5 border-t border-[var(--line)] pt-5">
            <CustomFoodPicker onSelect={addAiItem} />
          </div>
          <form className="mt-5 border-t border-[var(--line)] pt-5" onSubmit={addItem}>
            <p className="text-sm font-medium">Add selected food or manual item</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <input className="h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3" placeholder="Food name" value={selectedFood?.foodName ?? foodName} onChange={(event) => { setSelectedFood(null); setFoodName(event.target.value); }} required />
              <input className="h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3" min="1" type="number" placeholder="Weight g" value={weight} onChange={(event) => setWeight(event.target.value)} required />
              <input className="h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 disabled:opacity-60" disabled={Boolean(selectedFood)} min="0" step="0.01" type="number" placeholder="Manual calories/g" value={calories} onChange={(event) => setCalories(event.target.value)} required={!selectedFood} />
            </div>
            <button className="mt-4 h-11 rounded-xl border border-[var(--line)] px-4 text-sm font-semibold text-[var(--leaf)]" type="submit">Add item</button>
          </form>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="flex justify-between"><p className="font-semibold">Items</p><span className="text-sm text-[var(--ink-muted)]">{Math.round(total)} kcal total</span></div>
          {items.length === 0 ? <p className="mt-4 text-sm text-[var(--ink-muted)]">Add your first item. Portions remain weight-based.</p> : <div className="mt-4 space-y-2">{items.map((item, index) => <div className="flex justify-between text-sm" key={`${item.foodName}-${index}`}><span>{item.foodName} · {item.weightG}g</span><span>{Math.round(item.weightG * item.nutrientRate.caloriesPerG)} kcal</span></div>)}</div>}
          <button className="mt-5 h-11 w-full rounded-xl bg-[var(--leaf)] font-semibold text-white disabled:opacity-50" disabled={!name || items.length === 0} onClick={savePlan} type="button">Save plan</button>
          {message && <p className="mt-3 text-sm text-[var(--leaf)]" role="status">{message}</p>}
          {error && <p className="mt-3 text-sm text-[var(--coral)]" role="alert">{error}</p>}
        </div>
      </div>
    );
}
