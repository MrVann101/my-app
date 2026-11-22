"use client";

import { FormEvent, useMemo, useState } from "react";
import { IconCheck, IconCopy, IconListChecks, IconPlus, IconTrash } from "@/components/icons";
import {
  GROCERY_CATEGORY_ORDER,
  buildWeeklyGroceryList,
  formatGroceryListText,
  mergeWeeklyGroceryItems,
} from "@/lib/weekly-grocery";
import type { WeeklyPlanDay, WeeklyPlanGroceryState } from "@/lib/weekly-plan-schemas";

export type GroceryPlanOption = {
  id: number;
  name: string;
  itemCount: number;
  isActive?: boolean;
  isSelected: boolean;
};

export default function WeeklyGroceryList({
  planKey,
  planName,
  days,
  groceryState,
  onChangeGroceryState,
  planOptions,
  onSelectPlan,
}: {
  planKey: string;
  planName: string;
  days: WeeklyPlanDay[];
  groceryState: WeeklyPlanGroceryState;
  onChangeGroceryState: (next: WeeklyPlanGroceryState) => void;
  planOptions?: GroceryPlanOption[];
  onSelectPlan?: (planId: number) => void;
}) {
  const [newItemInput, setNewItemInput] = useState("");
  const [copied, setCopied] = useState(false);

  const generatedItems = useMemo(() => buildWeeklyGroceryList(days), [days]);

  const allItems = useMemo(
    () => mergeWeeklyGroceryItems(generatedItems, groceryState.custom),
    [generatedItems, groceryState.custom],
  );

  const checkedSet = useMemo(() => new Set(groceryState.checked), [groceryState.checked]);
  const checkedCount = useMemo(
    () => allItems.filter((item) => checkedSet.has(item.key)).length,
    [allItems, checkedSet],
  );
  const remainingCount = allItems.length - checkedCount;

  function toggleChecked(key: string) {
    const nextChecked = groceryState.checked.includes(key)
      ? groceryState.checked.filter((item) => item !== key)
      : [...groceryState.checked, key];
    onChangeGroceryState({
      checked: nextChecked,
      custom: groceryState.custom,
    });
  }

  function clearChecked() {
    onChangeGroceryState({
      checked: [],
      custom: groceryState.custom,
    });
  }

  function addCustomItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newItemInput.trim();
    if (!trimmed) return;
    if (!groceryState.custom.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      onChangeGroceryState({
        checked: groceryState.checked,
        custom: [...groceryState.custom, trimmed],
      });
    }
    setNewItemInput("");
  }

  function removeCustomItem(name: string, key: string) {
    onChangeGroceryState({
      checked: groceryState.checked.filter((item) => item !== key),
      custom: groceryState.custom.filter((item) => item.toLowerCase() !== name.toLowerCase()),
    });
  }

  async function handleCopy() {
    const text = formatGroceryListText(planName || "My Weekly Plan", allItems, checkedSet);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <section
      data-plan-key={planKey}
      className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs sm:p-6"
    >
      {/* Header & Utility Actions */}
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--leaf-light)] text-[var(--leaf-ink)]">
            <IconListChecks className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-[var(--foreground)]">Weekly Grocery List</h3>
              <span className="max-w-[220px] truncate rounded-full bg-[var(--surface-muted)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--ink-muted)]">
                {planName.trim() || "My Weekly Plan"}
              </span>
            </div>
            <p className="tabular-nums text-xs text-[var(--ink-muted)]">
              {remainingCount} left · {allItems.length} {allItems.length === 1 ? "item" : "items"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={allItems.length === 0}
            onClick={() => void handleCopy()}
            className="active-press inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--foreground)] hover:border-[var(--leaf)] disabled:opacity-45"
          >
            {copied ? <IconCheck className="size-4 text-[var(--leaf)]" /> : <IconCopy className="size-4 text-[var(--ink-muted)]" />}
            <span>{copied ? "Copied" : "Copy list"}</span>
          </button>
          <button
            type="button"
            disabled={checkedCount === 0}
            onClick={clearChecked}
            className="active-press inline-flex min-h-11 items-center rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--ink-muted)] hover:border-[var(--leaf)] hover:text-[var(--foreground)] disabled:opacity-45"
          >
            Clear checked
          </button>
        </div>
      </div>

      {planOptions && planOptions.length > 1 && onSelectPlan && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            Switch plan list
          </span>
          <div
            role="group"
            aria-label="Switch weekly plan grocery list"
            className="flex flex-wrap items-center gap-1.5"
          >
            {planOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.isSelected}
                onClick={() => onSelectPlan(option.id)}
                className={`active-press inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                  option.isSelected
                    ? "border-[var(--leaf)] bg-[var(--leaf-light)] text-[var(--leaf-ink)]"
                    : "border-[var(--line)] bg-[var(--background)]/60 text-[var(--ink-muted)] hover:border-[var(--leaf)]/60 hover:text-[var(--foreground)]"
                }`}
              >
                {option.isActive && (
                  <span className="size-1.5 shrink-0 rounded-full bg-[var(--leaf)]" aria-hidden="true" />
                )}
                <span className="max-w-[160px] truncate">{option.name}</span>
                <span className="tabular-nums rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--foreground)]">
                  {option.itemCount}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Custom Item */}
      <form className="flex gap-2" onSubmit={addCustomItem}>
        <label htmlFor="grocery-add-item" className="sr-only">
          Add grocery item
        </label>
        <input
          id="grocery-add-item"
          value={newItemInput}
          onChange={(event) => setNewItemInput(event.target.value)}
          maxLength={80}
          placeholder="Add grocery item (e.g. olive oil, sparkling water)..."
          className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3.5 text-sm outline-none focus:border-[var(--leaf)]"
        />
        <button
          type="submit"
          disabled={!newItemInput.trim()}
          className="active-press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--leaf)] px-4 text-xs font-bold text-[var(--on-leaf)] hover:bg-[var(--leaf-deep)] disabled:opacity-45"
        >
          <IconPlus className="size-4" />
          <span>Add</span>
        </button>
      </form>

      {/* Categorized Checklist */}
      {allItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-muted)]/60 p-6 text-center text-xs leading-5 text-[var(--ink-muted)]">
          Tap <strong className="text-[var(--foreground)]">Replace</strong> on meals in Day Schedule to populate ingredients automatically, or add items above.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {GROCERY_CATEGORY_ORDER.map((category) => {
            const items = allItems.filter((item) => item.category === category);
            if (items.length === 0) return null;

            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between border-b border-[var(--line)]/60 pb-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                    {category}
                  </h4>
                  <span className="tabular-nums text-[11px] font-semibold text-[var(--ink-muted)]">
                    {items.length}
                  </span>
                </div>

                <ul className="space-y-1.5">
                  {items.map((item) => {
                    const isChecked = checkedSet.has(item.key);
                    return (
                      <li key={item.key} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isChecked}
                          onClick={() => toggleChecked(item.key)}
                          className={`active-press flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
                            isChecked
                              ? "border-[var(--line)] bg-[var(--surface-muted)]/50 text-[var(--ink-muted)]"
                              : "border-[var(--line)] bg-[var(--background)]/40 text-[var(--foreground)] hover:border-[var(--leaf)]/60"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              aria-hidden="true"
                              className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${
                                isChecked
                                  ? "border-[var(--leaf)] bg-[var(--leaf)] text-[var(--on-leaf)]"
                                  : "border-[var(--border-control)] bg-[var(--surface)]"
                              }`}
                            >
                              {isChecked && <IconCheck className="size-3.5 stroke-[2.5]" />}
                            </span>
                            <span className={`truncate text-xs font-semibold sm:text-sm ${isChecked ? "line-through opacity-75" : ""}`}>
                              {item.name}
                            </span>
                          </div>

                          <span className="tabular-nums shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-muted)]">
                            {item.isCustom
                              ? "Custom"
                              : item.count > 1
                                ? `${item.count}× · ${item.days.join(", ")}`
                                : item.days.join(", ")}
                          </span>
                        </button>

                        {item.isCustom && (
                          <button
                            type="button"
                            aria-label={`Remove ${item.name} from grocery list`}
                            onClick={() => removeCustomItem(item.name, item.key)}
                            className="active-press grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--coral)]/40 hover:bg-[var(--coral-soft)] hover:text-[var(--coral)]"
                          >
                            <IconTrash className="size-4" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
