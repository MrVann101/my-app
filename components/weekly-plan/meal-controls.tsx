"use client";

import {
  IconCoffee,
  IconSnack,
  IconSun,
  IconUtensils,
} from "@/components/icons";

export function MealSlotIcon({ slotLabel, className }: { slotLabel: string; className?: string }) {
  const lower = slotLabel.toLowerCase();
  if (lower.includes("breakfast")) return <IconCoffee className={className} />;
  if (lower.includes("lunch")) return <IconSun className={className} />;
  if (lower.includes("dinner")) return <IconUtensils className={className} />;
  return <IconSnack className={className} />;
}

export function ServingsStepper({
  labelContext,
  servings,
  disabled,
  onChange,
}: {
  labelContext: string;
  servings: number;
  disabled: boolean;
  onChange: (nextServings: number) => void;
}) {
  const canDecrease = servings > 0.25;
  const canIncrease = servings < 12;

  function step(delta: number) {
    const next = Math.round((servings + delta) * 4) / 4;
    if (next >= 0.25 && next <= 12) onChange(next);
  }

  return (
    <div className="inline-flex items-center rounded-xl border border-[var(--border-control)] bg-[var(--surface)]">
      <button
        type="button"
        disabled={disabled || !canDecrease}
        aria-label={`Decrease servings for ${labelContext}`}
        onClick={() => step(-0.25)}
        className="active-press grid size-11 place-items-center rounded-l-xl text-base font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-35"
      >
        −
      </button>
      <span
        aria-label={`${labelContext} servings: ${servings}`}
        className="tabular-nums min-w-[3.25rem] border-x border-[var(--line)] px-2 text-center text-xs font-bold text-[var(--foreground)]"
      >
        {servings}×
      </span>
      <button
        type="button"
        disabled={disabled || !canIncrease}
        aria-label={`Increase servings for ${labelContext}`}
        onClick={() => step(0.25)}
        className="active-press grid size-11 place-items-center rounded-r-xl text-base font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-35"
      >
        +
      </button>
    </div>
  );
}
