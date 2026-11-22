import { EMPTY_GROCERY_STATE, type WeeklyPlanGroceryState } from "@/lib/weekly-plan-schemas";

const V2_STORAGE_PREFIX = "bitewise_grocery_v2_";
const LEGACY_STORAGE_PREFIX = "bitewise_grocery_state_";
const MAX_CHECKED_ITEMS = 200;
const MAX_CUSTOM_ITEMS = 100;

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function v2Key(planKey: string): string {
  return `${V2_STORAGE_PREFIX}${planKey}`;
}

function extractNumericPlanId(planKey: string): string | null {
  const match = /^plan-(\d+)$/.exec(planKey);
  return match ? match[1] : null;
}

function readStoredState(storage: Storage | null, key: string): WeeklyPlanGroceryState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return normalizeGroceryState(parsed);
  } catch {
    return null;
  }
}

function writeStoredState(storage: Storage | null, key: string, state: WeeklyPlanGroceryState): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(state));
  } catch {}
}

/** Create a unique draft storage key so unsaved weekly plans never share a grocery list. */
export function createDraftPlanKey(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return `draft-${globalThis.crypto.randomUUID()}`;
  }
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Return the isolated grocery storage key for a saved or draft weekly plan. */
export function getPlanGroceryKey(plan: { id?: number; draftId?: string }): string {
  if (typeof plan.id === "number") return `plan-${plan.id}`;
  return plan.draftId ?? "draft-ephemeral";
}

/** Trim, deduplicate, and bound grocery checked keys and custom items. */
export function normalizeGroceryState(raw: unknown): WeeklyPlanGroceryState {
  if (typeof raw !== "object" || raw === null) {
    return { checked: [], custom: [] };
  }

  const record = raw as { checked?: unknown; custom?: unknown };

  const checkedSeen = new Set<string>();
  const checked: string[] = [];
  if (Array.isArray(record.checked)) {
    for (const item of record.checked) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (!trimmed || trimmed.length > 120 || checkedSeen.has(trimmed)) continue;
      checkedSeen.add(trimmed);
      checked.push(trimmed);
      if (checked.length >= MAX_CHECKED_ITEMS) break;
    }
  }

  const customSeen = new Set<string>();
  const custom: string[] = [];
  if (Array.isArray(record.custom)) {
    for (const item of record.custom) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (!trimmed || trimmed.length > 80) continue;
      const lower = trimmed.toLowerCase();
      if (customSeen.has(lower)) continue;
      customSeen.add(lower);
      custom.push(trimmed);
      if (custom.length >= MAX_CUSTOM_ITEMS) break;
    }
  }

  return { checked, custom };
}

/** Load per-plan grocery state, keeping each saved plan and draft isolated and migrating legacy saved-plan keys once. */
export function loadPlanGroceryState(
  planKey: string,
  serverState?: WeeklyPlanGroceryState,
  storage?: Storage | null,
): WeeklyPlanGroceryState {
  const store = resolveStorage(storage);
  const currentV2Key = v2Key(planKey);
  const existingV2 = readStoredState(store, currentV2Key);
  const numericPlanId = extractNumericPlanId(planKey);
  const legacyKey = numericPlanId ? `${LEGACY_STORAGE_PREFIX}${numericPlanId}` : null;

  if (serverState !== undefined) {
    const normalizedServer = normalizeGroceryState(serverState);
    const hasServerItems = normalizedServer.checked.length > 0 || normalizedServer.custom.length > 0;

    if (hasServerItems || existingV2 !== null) {
      writeStoredState(store, currentV2Key, normalizedServer);
      return normalizedServer;
    }

    if (legacyKey) {
      const legacyState = readStoredState(store, legacyKey);
      if (legacyState && (legacyState.checked.length > 0 || legacyState.custom.length > 0)) {
        writeStoredState(store, currentV2Key, legacyState);
        return legacyState;
      }
    }

    return normalizedServer;
  }

  if (existingV2 !== null) {
    return existingV2;
  }

  if (legacyKey) {
    const legacyState = readStoredState(store, legacyKey);
    if (legacyState) {
      writeStoredState(store, currentV2Key, legacyState);
      return legacyState;
    }
  }

  return { ...EMPTY_GROCERY_STATE, checked: [], custom: [] };
}

/** Save normalized grocery state under the plan's isolated v2 localStorage key. */
export function savePlanGroceryState(
  planKey: string,
  state: WeeklyPlanGroceryState,
  storage?: Storage | null,
): WeeklyPlanGroceryState {
  const store = resolveStorage(storage);
  const normalized = normalizeGroceryState(state);
  writeStoredState(store, v2Key(planKey), normalized);
  return normalized;
}

/** Move a draft's grocery state to its persisted plan-<id> key and delete the temporary draft key. */
export function migrateDraftGroceryState(
  draftKey: string,
  savedPlanId: number,
  fallbackState?: WeeklyPlanGroceryState,
  storage?: Storage | null,
): WeeklyPlanGroceryState {
  const store = resolveStorage(storage);
  const storedDraft = readStoredState(store, v2Key(draftKey));
  const next = normalizeGroceryState(fallbackState ?? storedDraft ?? EMPTY_GROCERY_STATE);
  writeStoredState(store, v2Key(`plan-${savedPlanId}`), next);
  if (store) {
    try {
      store.removeItem(v2Key(draftKey));
    } catch {}
  }
  return next;
}

/** Remove local grocery storage for a deleted weekly plan (including its legacy key if present). */
export function removePlanGroceryState(
  planKey: string,
  legacyId?: number,
  storage?: Storage | null,
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.removeItem(v2Key(planKey));
    const resolvedLegacyId = typeof legacyId === "number" ? String(legacyId) : extractNumericPlanId(planKey);
    if (resolvedLegacyId) {
      store.removeItem(`${LEGACY_STORAGE_PREFIX}${resolvedLegacyId}`);
    }
  } catch {}
}
