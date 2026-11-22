import { isGenericSlotTitle, type WeeklyPlanDay, type WeeklyPlanMeal } from "@/lib/weekly-plan-schemas";

export type GroceryCategory = "Produce" | "Protein" | "Dairy & Eggs" | "Grains & Pantry" | "Other";

export type GroceryItem = {
  key: string;
  name: string;
  count: number;
  days: string[];
  category: GroceryCategory;
};

export type MergedGroceryItem = GroceryItem & { isCustom?: boolean };

export const GROCERY_CATEGORY_ORDER: GroceryCategory[] = [
  "Produce",
  "Protein",
  "Dairy & Eggs",
  "Grains & Pantry",
  "Other",
];

const PRODUCE_KEYWORDS = [
  "apple", "avocado", "banana", "berry", "berries", "blueberry", "strawberry", "raspberry",
  "broccoli", "cabbage", "carrot", "cauliflower", "celery", "cucumber", "garlic", "ginger",
  "grape", "greens", "kale", "lemon", "lettuce", "lime", "mango", "mushroom", "onion",
  "orange", "pear", "pea", "pepper", "pineapple", "potato", "salad", "spinach", "tomato",
  "vegetable", "veggies", "zucchini", "herbs", "cilantro", "parsley", "basil",
];

const PROTEIN_KEYWORDS = [
  "beef", "chicken", "cod", "duck", "edamame", "fish", "ham", "lamb", "lentil", "meat",
  "pork", "prawn", "protein", "salmon", "sausage", "shrimp", "steak", "tempeh", "tilapia",
  "tofu", "tuna", "turkey", "chickpea", "bean",
];

const DAIRY_EGGS_KEYWORDS = [
  "butter", "cheddar", "cheese", "cottage", "cream", "egg", "feta", "ghee", "kefir",
  "milk", "mozzarella", "parmesan", "ricotta", "yogurt",
];

const PANTRY_KEYWORDS = [
  "almond", "bagel", "bread", "chia", "cinnamon", "coconut", "couscous", "cracker",
  "drizzle", "farro", "flax", "flour", "granola", "honey", "hummus", "maple", "noodle",
  "nut", "oat", "oil", "olive", "pasta", "peanut", "quinoa", "rice", "salt", "sauce",
  "seed", "sesame", "soy", "spice", "sugar", "syrup", "tortilla", "vinegar", "walnut",
  "wheat", "wrap", "toast", "cashew", "pistachio",
];

const LEADING_MODIFIER_REGEX =
  /^(?:(?:\d+(?:[./]\d+)?\s*(?:cups?|tbsp|tsp|oz|g|kg|ml|l|slices?|pieces?|servings?)\s+)|(?:(?:a\s+)?(?:side|bowl|cup|handful|drizzle|squeeze|portion|plate|serving)\s+of\s+)|(?:(?:topped|served|paired)\s+with\s+)|(?:a|an|the|some|fresh|warm|cold|hot|steamed|grilled|baked|roasted|sauteed|sautéed|pan-seared|seared|boiled|poached|scrambled|fried|sliced|chopped|diced|shredded|mashed|mixed|seasonal|light|simple|homemade)\s+)+/i;

const SKIP_TERMS = new Set([
  "meal",
  "planned meal",
  "serving",
  "servings",
  "bowl",
  "plate",
  "dish",
  "side",
  "drizzle",
  "pinch",
  "taste",
  "topped",
  "served",
  "paired",
  "garnished",
]);

function normalizeItemName(raw: string): string {
  const stripped = raw
    .trim()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[()]/g, "")
    .replace(LEADING_MODIFIER_REGEX, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")
    .trim();

  if (!stripped) return "";
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

export function categorizeIngredient(name: string): GroceryCategory {
  const lower = name.toLowerCase();
  if (PROTEIN_KEYWORDS.some((kw) => lower.includes(kw))) return "Protein";
  if (DAIRY_EGGS_KEYWORDS.some((kw) => lower.includes(kw))) return "Dairy & Eggs";
  if (PRODUCE_KEYWORDS.some((kw) => lower.includes(kw))) return "Produce";
  if (PANTRY_KEYWORDS.some((kw) => lower.includes(kw))) return "Grains & Pantry";
  return "Other";
}

function isCleanFallbackFragment(cleaned: string): boolean {
  return (
    cleaned.length >= 2 &&
    cleaned.length <= 32 &&
    cleaned.split(/\s+/).length <= 4 &&
    !SKIP_TERMS.has(cleaned.toLowerCase()) &&
    !isGenericSlotTitle(cleaned)
  );
}

function extractFallbackIngredients(meal: WeeklyPlanMeal): string[] {
  const candidates: string[] = [];

  if (!isGenericSlotTitle(meal.title)) {
    const titleParts = meal.title.split(/\s*(?:,|&|\+|\/|\bwith\b|\band\b|\bover\b|\bon\b|\bin\b)\s*/i);
    for (const part of titleParts) {
      const cleaned = normalizeItemName(part);
      if (isCleanFallbackFragment(cleaned)) {
        candidates.push(cleaned);
        if (candidates.length >= 3) break;
      }
    }
  }

  if (candidates.length === 0 && meal.description && meal.description !== "A balanced meal.") {
    const descParts = meal.description.split(/\s*(?:,|&|\bserved with\b|\btopped with\b|\bwith\b|\band\b|\bover\b|\bon\b)\s*/i);
    for (const part of descParts) {
      const cleaned = normalizeItemName(part);
      if (isCleanFallbackFragment(cleaned)) {
        candidates.push(cleaned);
        if (candidates.length >= 3) break;
      }
    }
  }

  return candidates;
}

export function buildWeeklyGroceryList(days: WeeklyPlanDay[]): GroceryItem[] {
  const byKey = new Map<string, { name: string; count: number; days: string[]; daySet: Set<string> }>();

  for (const day of days) {
    const shortDay = day.day.slice(0, 3);
    for (const meal of day.meals) {
      const rawItems =
        meal.ingredients && meal.ingredients.length > 0
          ? meal.ingredients
          : extractFallbackIngredients(meal);

      for (const raw of rawItems) {
        const displayName = normalizeItemName(raw);
        if (!displayName || isGenericSlotTitle(displayName) || SKIP_TERMS.has(displayName.toLowerCase())) {
          continue;
        }
        const key = displayName.toLowerCase();
        const existing = byKey.get(key);
        if (existing) {
          existing.count += 1;
          if (!existing.daySet.has(shortDay)) {
            existing.daySet.add(shortDay);
            existing.days.push(shortDay);
          }
        } else {
          byKey.set(key, {
            name: displayName,
            count: 1,
            days: [shortDay],
            daySet: new Set([shortDay]),
          });
        }
      }
    }
  }

  const categoryRank = new Map(GROCERY_CATEGORY_ORDER.map((category, idx) => [category, idx]));

  return Array.from(byKey.entries())
    .map(([key, entry]) => ({
      key,
      name: entry.name,
      count: entry.count,
      days: entry.days,
      category: categorizeIngredient(entry.name),
    }))
    .sort((a, b) => {
      const rankDiff = (categoryRank.get(a.category) ?? 99) - (categoryRank.get(b.category) ?? 99);
      return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
    });
}

export function mergeWeeklyGroceryItems(
  generatedItems: readonly GroceryItem[],
  customItems: readonly string[] = [],
): MergedGroceryItem[] {
  const generatedKeys = new Set(generatedItems.map((item) => item.key));
  const seenCustom = new Set<string>();
  const extras: MergedGroceryItem[] = [];

  for (const raw of customItems) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const normalized = trimmed.toLowerCase();
    if (generatedKeys.has(normalized) || seenCustom.has(normalized)) continue;
    seenCustom.add(normalized);
    extras.push({
      key: `custom:${normalized}`,
      name: trimmed,
      count: 1,
      days: ["Added"],
      category: categorizeIngredient(trimmed),
      isCustom: true,
    });
  }

  return [...generatedItems, ...extras];
}

export function countWeeklyGroceryItems(
  days: WeeklyPlanDay[],
  customItems: readonly string[] = [],
): number {
  return mergeWeeklyGroceryItems(buildWeeklyGroceryList(days), customItems).length;
}

export function formatGroceryListText(
  planName: string,
  items: GroceryItem[],
  checkedKeys: ReadonlySet<string>,
): string {
  const remaining = items.filter((item) => !checkedKeys.has(item.key));
  const targetItems = remaining.length > 0 ? remaining : items;
  if (targetItems.length === 0) return `${planName} — Grocery List (empty)`;

  const lines: string[] = [`${planName} — Grocery List`];
  for (const category of GROCERY_CATEGORY_ORDER) {
    const group = targetItems.filter((item) => item.category === category);
    if (group.length === 0) continue;
    lines.push("", `${category}:`);
    for (const item of group) {
      const mark = checkedKeys.has(item.key) ? "[x]" : "[ ]";
      const suffix = item.count > 1 ? ` (${item.count}x · ${item.days.join(", ")})` : ` (${item.days.join(", ")})`;
      lines.push(`${mark} ${item.name}${suffix}`);
    }
  }
  return lines.join("\n");
}
