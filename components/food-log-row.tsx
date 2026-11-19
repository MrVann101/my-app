"use client";

import { useEffect, useRef, useState } from "react";

export type FoodLogRowData = {
  id: number;
  food_name: string;
  meal_type: string;
  weight_g?: number;
  calories: number;
  source?: string;
  is_recipe?: boolean;
  log_date?: string;
};

type Props = {
  log: FoodLogRowData;
  onChanged: () => void;
};

export default function FoodLogRow({ log, onChanged }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [weight, setWeight] = useState(String(log.weight_g ?? 100));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const keepLogRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showDelete) return;
    const deleteTrigger = deleteTriggerRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !keepLogRef.current?.disabled) {
        event.preventDefault();
        setShowDelete(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    keepLogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (deleteTrigger?.isConnected) deleteTrigger.focus();
    };
  }, [showDelete]);

  async function saveWeight() {
    const nextWeight = Number(weight);
    if (!Number.isInteger(nextWeight) || nextWeight < 1 || nextWeight > 100000) {
      setError("Enter a whole number between 1g and 100,000g.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/food/log/${log.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightG: nextWeight }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to update this log.");
      setIsEditing(false);
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update this log.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteLog() {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/food/log/${log.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to delete this log.");
      setShowDelete(false);
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete this log.");
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="py-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-[var(--foreground)]">{log.food_name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)]">
              <span className="capitalize font-semibold text-[var(--leaf)]">{log.meal_type}</span>
              <span aria-hidden="true">·</span>
              {log.weight_g ? <span>{log.is_recipe ? `${log.weight_g} serving${log.weight_g === 1 ? "" : "s"}` : `${log.weight_g}g`}</span> : null}
              {log.source ? <><span aria-hidden="true">·</span><span className="uppercase text-[10px] font-bold">{log.source}</span></> : null}
            </div>
          </div>
          <span className="tabular-nums shrink-0 font-extrabold text-[var(--foreground)]">{Math.round(Number(log.calories))} kcal</span>
        </div>

        {isEditing ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`weight-${log.id}`}>Weight in grams</label>
            <input
              id={`weight-${log.id}`}
              className="h-11 w-28 rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-bold"
              type="number"
              min="1"
              max="100000"
              step="1"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              disabled={isSaving}
            />
            <button type="button" className="active-press h-11 rounded-xl bg-[var(--leaf)] px-4 text-xs font-bold text-[var(--on-leaf)] disabled:opacity-50" onClick={() => void saveWeight()} disabled={isSaving}>Save</button>
            <button type="button" className="active-press h-11 rounded-xl border border-[var(--line)] px-4 text-xs font-bold text-[var(--foreground)] disabled:opacity-50" onClick={() => { setIsEditing(false); setWeight(String(log.weight_g ?? 100)); }} disabled={isSaving}>Cancel</button>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="active-press min-h-11 rounded-xl border border-[var(--line)] px-3 text-xs font-bold text-[var(--leaf)] hover:bg-[var(--surface-muted)]" onClick={() => setIsEditing(true)}>Edit weight</button>
            <button ref={deleteTriggerRef} type="button" className="active-press min-h-11 rounded-xl border border-[var(--coral)]/30 px-3 text-xs font-bold text-[var(--coral)] hover:bg-[var(--coral)]/10" onClick={() => setShowDelete(true)}>Delete</button>
          </div>
        )}
        {error && <p className="mt-2 text-xs font-semibold text-[var(--coral)]" role="alert">{error}</p>}
      </div>

      {showDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--scrim)] p-4" role="presentation">
          <div className="dialog-enter w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-lg" role="alertdialog" aria-modal="true" aria-labelledby={`delete-title-${log.id}`} aria-describedby={`delete-description-${log.id}`}>
            <h2 id={`delete-title-${log.id}`} className="text-base font-bold text-[var(--foreground)]">Delete this food log?</h2>
            <p id={`delete-description-${log.id}`} className="mt-2 text-sm text-[var(--ink-muted)]">“{log.food_name}” will be removed and today&apos;s totals will be recalculated.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button ref={keepLogRef} type="button" className="active-press min-h-11 rounded-xl border border-[var(--line)] text-sm font-bold text-[var(--foreground)]" onClick={() => setShowDelete(false)} disabled={isSaving}>Keep log</button>
              <button type="button" className="active-press min-h-11 rounded-xl bg-[var(--coral)] px-3 text-sm font-bold text-white disabled:opacity-50" onClick={() => void deleteLog()} disabled={isSaving}>{isSaving ? "Deleting…" : "Delete log"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
