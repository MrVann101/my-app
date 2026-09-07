"use client";

import { useEffect, useState } from "react";
import { IconRefresh } from "@/components/icons";

type Favorite = { id: number; food_name: string; default_weight_g: number; calories_per_g: number; protein_per_g: number; carbs_per_g: number; fat_per_g: number; fiber_per_g: number; sodium_per_g: number; sugar_per_g: number; use_count: number };

export default function Favorites({ onLogged }: { onLogged?: () => void }) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/favorites");
    const payload = await response.json();
    if (!response.ok) { setError(payload.error?.message ?? "Unable to load favorites."); return; }
    setFavorites(payload.favorites ?? []);
  }

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function relog(favorite: Favorite) {
    setError(null);
    setStatus(null);
    const response = await fetch("/api/food/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logDate: new Date().toISOString().slice(0, 10), mealType: "snack", foodName: favorite.food_name, weightG: favorite.default_weight_g, nutrientRate: { caloriesPerG: favorite.calories_per_g, proteinPerG: favorite.protein_per_g, carbsPerG: favorite.carbs_per_g, fatPerG: favorite.fat_per_g, fiberPerG: favorite.fiber_per_g, sodiumPerG: favorite.sodium_per_g, sugarPerG: favorite.sugar_per_g }, source: "database", dataSource: null, aiConfidence: null }) });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error?.message ?? "Unable to log favorite."); return; }
    setStatus(`${favorite.food_name} added to today's log.`);
    await load();
    onLogged?.();
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm text-[var(--foreground)]">Favorites & Recent Foods</p>
        <button
          className="active-press inline-flex items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-2 text-[var(--ink-muted)] hover:bg-[var(--line)] hover:text-[var(--foreground)]"
          onClick={() => void load()}
          type="button"
          title="Refresh favorites"
          aria-label="Refresh favorites"
        >
          <IconRefresh className="size-4" />
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-[var(--coral)]" role="alert">{error}</p>}
      {status && <p className="mt-3 text-xs text-[var(--leaf)]" role="status">{status}</p>}
      {favorites.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--ink-muted)]">Save a food from the form above to re-log its default portion here.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {favorites.map((favorite) => (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] p-3" key={favorite.id}>
              <span>
                <strong className="block text-xs font-bold text-[var(--foreground)]">{favorite.food_name}</strong>
                <span className="text-[11px] text-[var(--ink-muted)]">{favorite.default_weight_g}g · used {favorite.use_count} times</span>
              </span>
              <button className="rounded-lg bg-[var(--leaf)] px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[var(--leaf-deep)]" onClick={() => void relog(favorite)} type="button">
                Log portion
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

