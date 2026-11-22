import { describe, expect, it } from "vitest";
import {
  createDraftPlanKey,
  getPlanGroceryKey,
  loadPlanGroceryState,
  migrateDraftGroceryState,
  normalizeGroceryState,
  removePlanGroceryState,
  savePlanGroceryState,
} from "./weekly-grocery-storage";

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key) {
      return data.get(key) ?? null;
    },
    key(index) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key) {
      data.delete(key);
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
}

describe("weekly grocery per-plan storage", () => {
  it("isolates saved plans and never shares keys across two drafts", () => {
    const storage = createMemoryStorage();
    const draftA = createDraftPlanKey();
    const draftB = createDraftPlanKey();

    expect(draftA).not.toBe(draftB);
    expect(draftA).toMatch(/^draft-/);
    expect(getPlanGroceryKey({ id: 12, draftId: draftA })).toBe("plan-12");
    expect(getPlanGroceryKey({ draftId: draftA })).toBe(draftA);

    savePlanGroceryState("plan-1", { checked: ["spinach"], custom: ["Olive oil"] }, storage);
    savePlanGroceryState("plan-2", { checked: ["oats"], custom: ["Almond milk"] }, storage);
    savePlanGroceryState(draftA, { checked: ["eggs"], custom: ["Avocado"] }, storage);

    storage.setItem("bitewise_grocery_state_draft", JSON.stringify({ checked: ["stale"], custom: ["Leaked"] }));

    expect(loadPlanGroceryState("plan-1", undefined, storage)).toEqual({
      checked: ["spinach"],
      custom: ["Olive oil"],
    });
    expect(loadPlanGroceryState("plan-2", undefined, storage)).toEqual({
      checked: ["oats"],
      custom: ["Almond milk"],
    });
    expect(loadPlanGroceryState(draftA, undefined, storage)).toEqual({
      checked: ["eggs"],
      custom: ["Avocado"],
    });
    expect(loadPlanGroceryState(draftB, undefined, storage)).toEqual({
      checked: [],
      custom: [],
    });
  });

  it("migrates draft grocery state to plan-<id> on save and cleans up deleted plans", () => {
    const storage = createMemoryStorage();
    const draftKey = createDraftPlanKey();

    savePlanGroceryState(draftKey, { checked: ["blueberries"], custom: ["Sparkling water"] }, storage);
    const migrated = migrateDraftGroceryState(draftKey, 42, undefined, storage);

    expect(migrated).toEqual({
      checked: ["blueberries"],
      custom: ["Sparkling water"],
    });
    expect(storage.getItem(`bitewise_grocery_v2_${draftKey}`)).toBeNull();
    expect(loadPlanGroceryState("plan-42", undefined, storage)).toEqual(migrated);

    storage.setItem("bitewise_grocery_state_42", JSON.stringify({ checked: ["legacy"], custom: [] }));
    removePlanGroceryState("plan-42", 42, storage);

    expect(storage.getItem("bitewise_grocery_v2_plan-42")).toBeNull();
    expect(storage.getItem("bitewise_grocery_state_42")).toBeNull();
  });

  it("uses server groceryState once synced while migrating untouched legacy plan storage once", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "bitewise_grocery_state_7",
      JSON.stringify({ checked: ["salmon"], custom: ["Sea salt"] }),
    );

    expect(loadPlanGroceryState("plan-7", { checked: [], custom: [] }, storage)).toEqual({
      checked: ["salmon"],
      custom: ["Sea salt"],
    });

    expect(loadPlanGroceryState("plan-7", { checked: [], custom: [] }, storage)).toEqual({
      checked: [],
      custom: [],
    });

    expect(loadPlanGroceryState("plan-8", { checked: ["tofu"], custom: ["Soy sauce"] }, storage)).toEqual({
      checked: ["tofu"],
      custom: ["Soy sauce"],
    });
  });

  it("normalizes duplicates, whitespace, and invalid entries", () => {
    expect(
      normalizeGroceryState({
        checked: [" oats ", "oats", "", "milk"],
        custom: [" Olive oil ", "olive oil", "   ", 123],
      }),
    ).toEqual({
      checked: ["oats", "milk"],
      custom: ["Olive oil"],
    });
  });
});
