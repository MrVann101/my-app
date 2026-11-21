import { describe, expect, it } from "vitest";
import { defaultMealTypeByHour, normalizeMealSlot } from "./meal-slot";

describe("meal-slot helpers", () => {
  it("normalizes valid meal slots and plural snacks", () => {
    expect(normalizeMealSlot("breakfast")).toBe("breakfast");
    expect(normalizeMealSlot("LUNCH")).toBe("lunch");
    expect(normalizeMealSlot("snacks")).toBe("snack");
    expect(normalizeMealSlot("unknown")).toBeNull();
    expect(normalizeMealSlot(null)).toBeNull();
  });

  it("picks default meal slot by hour of day", () => {
    expect(defaultMealTypeByHour(new Date(2026, 0, 1, 8, 30))).toBe("breakfast");
    expect(defaultMealTypeByHour(new Date(2026, 0, 1, 13, 0))).toBe("lunch");
    expect(defaultMealTypeByHour(new Date(2026, 0, 1, 18, 45))).toBe("dinner");
    expect(defaultMealTypeByHour(new Date(2026, 0, 1, 22, 15))).toBe("snack");
  });
});
