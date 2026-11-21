"use client";

import { useRef, useState } from "react";
import Dialog from "./dialog";
import { IconTrash } from "./icons";

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
  dateLabel?: string;
};

export default function FoodLogRow({ log, onChanged, dateLabel = "today's" }: Props) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [weight, setWeight] = useState(String(log.weight_g ?? (log.is_recipe ? 1 : 100)));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const keepLogRef = useRef<HTMLButtonElement>(null);

  async function saveWeight() {
    const nextWeight = Number(weight);
    if (!Number.isFinite(nextWeight) || nextWeight <= 0 || nextWeight > 100000) {
      setError(log.is_recipe ? "Enter servings between 0.25 and 100,000." : "Enter a portion weight between 1g and 100,000g.");
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
      setShowActions(false);
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update this log.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteLog() {
    setIsSaving(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/food/log/${log.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to delete this log.");
      setShowDelete(false);
      onChanged();
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : "Unable to delete this log.");
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="py-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-[var(--foreground)]">{log.food_name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-muted)]">
              <span className="font-semibold capitalize text-[var(--leaf)]">{log.meal_type}</span>
              {log.weight_g ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {log.is_recipe ? `${log.weight_g} serving${log.weight_g === 1 ? "" : "s"}` : `${log.weight_g}g`}
                  </span>
                </>
              ) : null}
              {log.source ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[10px] font-bold uppercase">{log.source}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="tabular-nums font-extrabold text-[var(--foreground)]">
              {Math.round(Number(log.calories))} kcal
            </span>
            <button
              type="button"
              aria-expanded={showActions}
              aria-label={`Adjust or remove ${log.food_name}`}
              onClick={() => {
                setShowActions((open) => !open);
                setIsEditing(false);
                setError(null);
              }}
              className="active-press inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-xs font-bold text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            >
              {showActions ? "Done" : "Edit"}
            </button>
          </div>
        </div>

        {showActions && !isEditing && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="active-press min-h-11 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3.5 text-xs font-bold text-[var(--leaf)] hover:bg-[var(--surface-muted)]"
              onClick={() => {
                setWeight(String(log.weight_g ?? (log.is_recipe ? 1 : 100)));
                setIsEditing(true);
              }}
            >
              {log.is_recipe ? "Edit servings" : "Edit weight"}
            </button>
            <button
              type="button"
              className="active-press inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--coral)]/40 bg-[var(--surface)] px-3.5 text-xs font-bold text-[var(--coral)] hover:bg-[var(--coral-soft)]"
              onClick={() => {
                setDeleteError(null);
                setShowDelete(true);
              }}
            >
              <IconTrash className="size-3.5" />
              <span>Delete</span>
            </button>
          </div>
        )}

        {isEditing && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`weight-${log.id}`}>
              {log.is_recipe ? "Servings" : "Weight in grams"}
            </label>
            <input
              id={`weight-${log.id}`}
              className="tabular-nums h-11 w-28 rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3 text-sm font-bold outline-none focus:border-[var(--leaf)]"
              type="number"
              inputMode={log.is_recipe ? "decimal" : "numeric"}
              min={log.is_recipe ? "0.25" : "1"}
              max="100000"
              step={log.is_recipe ? "0.25" : "1"}
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              disabled={isSaving}
            />
            <button
              type="button"
              className="active-press h-11 rounded-xl bg-[var(--leaf)] px-4 text-xs font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:opacity-50"
              onClick={() => void saveWeight()}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="active-press h-11 rounded-xl border border-[var(--border-control)] px-4 text-xs font-bold text-[var(--foreground)] disabled:opacity-50"
              onClick={() => {
                setIsEditing(false);
                setError(null);
                setWeight(String(log.weight_g ?? (log.is_recipe ? 1 : 100)));
              }}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-xs font-semibold text-[var(--coral)]" role="alert">{error}</p>}
      </div>

      <Dialog
        open={showDelete}
        onClose={() => {
          if (!isSaving) setShowDelete(false);
        }}
        role="alertdialog"
        titleId={`delete-title-${log.id}`}
        descriptionId={`delete-description-${log.id}`}
        initialFocusRef={keepLogRef}
        maxWidthClass="max-w-sm"
        closeOnScrim={!isSaving}
      >
        <h2 id={`delete-title-${log.id}`} className="text-base font-bold text-[var(--foreground)]">
          Delete this food log?
        </h2>
        <p id={`delete-description-${log.id}`} className="mt-2 text-sm text-[var(--ink-muted)]">
          &ldquo;{log.food_name}&rdquo; will be removed and {dateLabel} totals will be recalculated.
        </p>
        {deleteError && (
          <p className="mt-3 rounded-xl bg-[var(--coral-soft)] p-3 text-xs font-semibold text-[var(--coral)]" role="alert">
            {deleteError}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            ref={keepLogRef}
            type="button"
            className="active-press min-h-11 rounded-xl border border-[var(--border-control)] text-sm font-bold text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
            onClick={() => setShowDelete(false)}
            disabled={isSaving}
          >
            Keep log
          </button>
          <button
            type="button"
            className="active-press min-h-11 rounded-xl bg-[var(--coral)] px-3 text-sm font-bold text-[var(--on-coral)] hover:opacity-90 disabled:opacity-50"
            onClick={() => void deleteLog()}
            disabled={isSaving}
          >
            {isSaving ? "Deleting…" : "Delete log"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
