import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { uploadOfficialMealPhotos } from "./sync-public-plan-photos.mjs";

const envFile = new URL("../.env.local", import.meta.url);
try {
  const contents = await readFile(envFile, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {
  // Environment variables provided directly.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}
if (!process.argv.includes("--confirm-wipe")) {
  throw new Error(
    "Refusing to run destructive database/storage reset without explicit --confirm-wipe flag.",
  );
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEAM_EMAIL = "team@bitewise.app";
const TEAM_USERNAME = "Bitewise Team";

const BITEWISE_PUBLIC_MEAL_PLANS = [
  {
    goal: "lose",
    diet_type: "filipino-balanced",
    recipe: {
      title: "High-Protein Chicken Tinola Bowl",
      description: "Ginger-garlic chicken breast simmered with green papaya and malunggay over warm jasmine rice.",
      cookTimeMinutes: 25,
      servings: 2,
      nutrition: { calories: 430, proteinG: 42, carbsG: 38, fatG: 11 },
      ingredients: [
        { name: "Skinless chicken breast, cubed", amount: "320 g", pantryStaple: false },
        { name: "Green papaya, wedged", amount: "200 g", pantryStaple: false },
        { name: "Fresh malunggay or baby spinach leaves", amount: "2 cups", pantryStaple: false },
        { name: "Fresh ginger, julienned", amount: "2 tbsp", pantryStaple: false },
        { name: "Garlic & yellow onion", amount: "1 small onion + 4 cloves", pantryStaple: true },
        { name: "Cooked jasmine rice", amount: "200 g", pantryStaple: false },
        { name: "Olive or avocado oil", amount: "1 tsp", pantryStaple: true },
      ],
      steps: [
        "Warm oil in a pot over medium heat and sauté onion, garlic, and ginger until fragrant.",
        "Add chicken breast pieces and sear for 3–4 minutes until lightly opaque.",
        "Pour in 3 cups of water or low-sodium chicken broth, bring to a gentle boil, and add green papaya wedges.",
        "Simmer for 10–12 minutes until chicken is cooked through and papaya is tender.",
        "Stir in malunggay or spinach leaves for 1 minute, season lightly, and ladle over warm jasmine rice.",
      ],
    },
  },
  {
    goal: "maintain",
    diet_type: "mediterranean",
    recipe: {
      title: "Mediterranean Herb Salmon & Quinoa",
      description: "Lemon-oregano pan-seared salmon served over fluffy quinoa with crisp cucumber and cherry tomatoes.",
      cookTimeMinutes: 22,
      servings: 2,
      nutrition: { calories: 560, proteinG: 44, carbsG: 42, fatG: 23 },
      ingredients: [
        { name: "Atlantic or wild salmon fillets", amount: "300 g (2 fillets)", pantryStaple: false },
        { name: "Dry quinoa, rinsed", amount: "110 g", pantryStaple: false },
        { name: "Cherry tomatoes, halved", amount: "150 g", pantryStaple: false },
        { name: "Cucumber, diced", amount: "120 g", pantryStaple: false },
        { name: "Extra-virgin olive oil", amount: "1 tbsp", pantryStaple: true },
        { name: "Fresh lemon juice & dried oregano", amount: "1 lemon + 1 tsp", pantryStaple: true },
      ],
      steps: [
        "Simmer rinsed quinoa in 1 cup water for 15 minutes until fluffy, then let rest covered for 5 minutes.",
        "Season salmon fillets with oregano, salt, pepper, and half the lemon juice.",
        "Sear salmon skin-side down in olive oil over medium-high heat for 4 minutes per side until flaky.",
        "Toss cooked quinoa with cucumber, cherry tomatoes, and remaining lemon juice, then top with salmon.",
      ],
    },
  },
  {
    goal: "lose",
    diet_type: "high-protein",
    recipe: {
      title: "Greek Yogurt Berry Protein Parfait",
      description: "Creamy nonfat Greek yogurt layered with mixed berries, rolled oats, chia seeds, and toasted almonds.",
      cookTimeMinutes: 8,
      servings: 1,
      nutrition: { calories: 360, proteinG: 28, carbsG: 41, fatG: 8 },
      ingredients: [
        { name: "Plain nonfat Greek yogurt", amount: "220 g", pantryStaple: false },
        { name: "Fresh blueberries & strawberries", amount: "120 g", pantryStaple: false },
        { name: "Rolled oats", amount: "30 g", pantryStaple: true },
        { name: "Chia seeds", amount: "1 tsp", pantryStaple: true },
        { name: "Sliced toasted almonds", amount: "10 g", pantryStaple: false },
        { name: "Pure honey", amount: "1 tsp", pantryStaple: true },
      ],
      steps: [
        "Stir chia seeds into the Greek yogurt in a bowl or jar.",
        "Layer half of the yogurt with rolled oats and half of the fresh berries.",
        "Top with the remaining yogurt, berries, sliced almonds, and a light drizzle of honey.",
      ],
    },
  },
  {
    goal: "gain",
    diet_type: "high-protein",
    recipe: {
      title: "Lean Beef & Broccoli Garlic Stir-Fry",
      description: "Tender sirloin strips tossed with crisp-tender broccoli in a savory ginger-garlic glaze over brown rice.",
      cookTimeMinutes: 20,
      servings: 2,
      nutrition: { calories: 620, proteinG: 48, carbsG: 64, fatG: 18 },
      ingredients: [
        { name: "Lean beef sirloin, thinly sliced", amount: "320 g", pantryStaple: false },
        { name: "Broccoli florets", amount: "260 g", pantryStaple: false },
        { name: "Cooked brown rice", amount: "320 g", pantryStaple: false },
        { name: "Low-sodium soy sauce", amount: "2 tbsp", pantryStaple: true },
        { name: "Minced garlic & grated ginger", amount: "1 tbsp", pantryStaple: true },
        { name: "Toasted sesame oil", amount: "2 tsp", pantryStaple: true },
        { name: "Cornstarch", amount: "1 tsp", pantryStaple: true },
      ],
      steps: [
        "Whisk soy sauce, 3 tablespoons water, cornstarch, garlic, and ginger in a small bowl.",
        "Steam or blanch broccoli florets for 2 minutes until bright green, then drain.",
        "Sear sliced sirloin in sesame oil over high heat for 2–3 minutes until browned.",
        "Return broccoli to the pan, pour in the garlic sauce, toss for 1 minute until glossy, and serve over brown rice.",
      ],
    },
  },
  {
    goal: "maintain",
    diet_type: "vegetarian",
    recipe: {
      title: "Crispy Tofu & Edamame Sesame Bowl",
      description: "Golden pan-seared tofu, shelled edamame, shredded carrots, and red cabbage over warm brown rice.",
      cookTimeMinutes: 20,
      servings: 2,
      nutrition: { calories: 490, proteinG: 31, carbsG: 52, fatG: 17 },
      ingredients: [
        { name: "Extra-firm tofu, pressed and cubed", amount: "280 g", pantryStaple: false },
        { name: "Shelled edamame, steamed", amount: "140 g", pantryStaple: false },
        { name: "Cooked brown or jasmine rice", amount: "240 g", pantryStaple: false },
        { name: "Shredded carrots & red cabbage", amount: "160 g", pantryStaple: false },
        { name: "Low-sodium soy sauce & rice vinegar", amount: "2 tbsp", pantryStaple: true },
        { name: "Sesame oil & toasted sesame seeds", amount: "2 tsp", pantryStaple: true },
      ],
      steps: [
        "Pat cubed tofu dry and pan-sear in a nonstick skillet with sesame oil for 6–8 minutes until crisp on all sides.",
        "Whisk soy sauce, rice vinegar, and 1 teaspoon warm water for a quick dressing.",
        "Divide warm rice into bowls and arrange crispy tofu, steamed edamame, carrots, and cabbage on top.",
        "Drizzle with the dressing and finish with toasted sesame seeds.",
      ],
    },
  },
  {
    goal: "lose",
    diet_type: "filipino-balanced",
    recipe: {
      title: "Garlic Lemon Chicken Adobo (Light)",
      description: "Trimmed chicken thighs braised in cane vinegar, crushed garlic, and bay leaves with steamed broccoli and rice.",
      cookTimeMinutes: 30,
      servings: 3,
      nutrition: { calories: 465, proteinG: 45, carbsG: 36, fatG: 14 },
      ingredients: [
        { name: "Boneless skinless chicken thighs, trimmed", amount: "450 g", pantryStaple: false },
        { name: "Crushed garlic cloves", amount: "8 cloves", pantryStaple: true },
        { name: "Cane or coconut vinegar", amount: "3 tbsp", pantryStaple: true },
        { name: "Low-sodium soy sauce", amount: "2.5 tbsp", pantryStaple: true },
        { name: "Bay leaves & cracked black pepper", amount: "2 leaves + 1 tsp", pantryStaple: true },
        { name: "Steamed broccoli florets", amount: "240 g", pantryStaple: false },
        { name: "Cooked jasmine rice", amount: "300 g", pantryStaple: false },
      ],
      steps: [
        "Marinate chicken thighs with garlic, low-sodium soy sauce, black pepper, and bay leaves for 10 minutes.",
        "Sear chicken in a hot nonstick pan for 3 minutes per side until lightly golden.",
        "Add vinegar and 1/2 cup water without stirring for 2 minutes, then cover and simmer 15 minutes until tender.",
        "Reduce the glaze until glossy, finish with a squeeze of lemon or calamansi, and serve with rice and broccoli.",
      ],
    },
  },
  {
    goal: "lose",
    diet_type: "low-carb",
    recipe: {
      title: "Turkey, Spinach & Feta Egg White Wrap",
      description: "Fluffy egg whites, sliced turkey breast, wilted baby spinach, and tangy feta rolled in a whole-wheat wrap.",
      cookTimeMinutes: 12,
      servings: 1,
      nutrition: { calories: 380, proteinG: 36, carbsG: 29, fatG: 13 },
      ingredients: [
        { name: "Liquid egg whites (or 4 egg whites + 1 whole egg)", amount: "150 g", pantryStaple: false },
        { name: "Sliced roasted turkey breast", amount: "75 g", pantryStaple: false },
        { name: "Fresh baby spinach", amount: "60 g", pantryStaple: false },
        { name: "Crumbled feta cheese", amount: "25 g", pantryStaple: false },
        { name: "Whole-wheat tortilla wrap", amount: "1 wrap (60 g)", pantryStaple: false },
        { name: "Olive oil spray or 1/2 tsp olive oil", amount: "2 g", pantryStaple: true },
      ],
      steps: [
        "Wilt baby spinach in a lightly oiled nonstick skillet over medium heat for 1 minute.",
        "Add diced turkey breast and pour in egg whites, scrambling gently until softly set.",
        "Warm the whole-wheat tortilla, spoon in the scramble, top with crumbled feta, and roll tightly.",
      ],
    },
  },
  {
    goal: "gain",
    diet_type: "balanced",
    recipe: {
      title: "Creamy Peanut Banana Overnight Oats",
      description: "Rolled oats soaked in milk and Greek yogurt with natural peanut butter, ripe banana, and ground flaxseed.",
      cookTimeMinutes: 5,
      servings: 1,
      nutrition: { calories: 540, proteinG: 26, carbsG: 68, fatG: 18 },
      ingredients: [
        { name: "Old-fashioned rolled oats", amount: "65 g", pantryStaple: true },
        { name: "Low-fat milk or unsweetened soy milk", amount: "160 ml", pantryStaple: false },
        { name: "Plain Greek yogurt", amount: "100 g", pantryStaple: false },
        { name: "Natural peanut butter", amount: "1 tbsp (16 g)", pantryStaple: true },
        { name: "Ripe banana, sliced", amount: "1 medium (100 g)", pantryStaple: false },
        { name: "Ground flaxseed & cinnamon", amount: "1 tsp", pantryStaple: true },
      ],
      steps: [
        "Combine rolled oats, milk, Greek yogurt, ground flaxseed, and cinnamon in a jar until smooth.",
        "Swirl in natural peanut butter, cover, and refrigerate for at least 4 hours or overnight.",
        "Top with fresh banana slices right before serving.",
      ],
    },
  },
  {
    goal: "maintain",
    diet_type: "high-protein",
    recipe: {
      title: "Sheet-Pan Garlic Shrimp & Sweet Potato",
      description: "Smoked-paprika garlic shrimp roasted alongside caramelized sweet potato cubes and tender asparagus.",
      cookTimeMinutes: 25,
      servings: 2,
      nutrition: { calories: 480, proteinG: 39, carbsG: 46, fatG: 14 },
      ingredients: [
        { name: "Peeled and deveined large shrimp", amount: "320 g", pantryStaple: false },
        { name: "Sweet potato, peeled and cubed", amount: "300 g", pantryStaple: false },
        { name: "Fresh asparagus spears, trimmed", amount: "200 g", pantryStaple: false },
        { name: "Extra-virgin olive oil", amount: "1.5 tbsp", pantryStaple: true },
        { name: "Minced garlic & smoked paprika", amount: "3 cloves + 1 tsp", pantryStaple: true },
        { name: "Fresh lemon wedges", amount: "1/2 lemon", pantryStaple: false },
      ],
      steps: [
        "Preheat oven to 200°C (400°F). Toss sweet potato cubes with half the olive oil, salt, and paprika, then roast for 15 minutes.",
        "Toss shrimp and asparagus with remaining olive oil and minced garlic, then spread onto the sheet pan.",
        "Roast 7–8 minutes more until shrimp are pink and opaque, then squeeze fresh lemon juice over top.",
      ],
    },
  },
  {
    goal: "maintain",
    diet_type: "vegetarian",
    recipe: {
      title: "Roasted Chickpea & Avocado Power Salad",
      description: "Crispy cumin-spiced chickpeas, creamy avocado, roasted bell peppers, and pumpkin seeds with lemon-tahini dressing.",
      cookTimeMinutes: 18,
      servings: 2,
      nutrition: { calories: 470, proteinG: 19, carbsG: 49, fatG: 22 },
      ingredients: [
        { name: "Cooked chickpeas, drained and patted dry", amount: "240 g", pantryStaple: false },
        { name: "Mixed salad greens & baby arugula", amount: "140 g", pantryStaple: false },
        { name: "Ripe avocado, diced", amount: "100 g", pantryStaple: false },
        { name: "Red bell pepper, diced", amount: "120 g", pantryStaple: false },
        { name: "Roasted pumpkin seeds (pepitas)", amount: "20 g", pantryStaple: false },
        { name: "Tahini, lemon juice & cumin", amount: "1.5 tbsp tahini + 1 lemon", pantryStaple: true },
      ],
      steps: [
        "Crisp drained chickpeas in a skillet or air fryer with a pinch of cumin and salt for 10 minutes until crunchy.",
        "Whisk tahini, fresh lemon juice, and 2 tablespoons warm water until pourable.",
        "Toss mixed greens, bell pepper, diced avocado, crispy chickpeas, and pumpkin seeds with the lemon-tahini dressing.",
      ],
    },
  },
];

function isAutomatedTestUser(user) {
  const email = (user.email ?? "").toLowerCase();
  const username = String(user.user_metadata?.username ?? "").toLowerCase();
  if (email === TEAM_EMAIL) return false;
  if (email.endsWith("@example.com")) return true;
  if (/^(rls_|fork_|test_|purge_|cap_|del_|rollup_)/.test(email)) return true;
  if (/^(rls_|fork_|test_)/.test(username)) return true;
  return false;
}

async function clearTable(table, filterColumn = "id") {
  const { error } =
    filterColumn === "user_id"
      ? await admin.from(table).delete().not("user_id", "is", null)
      : await admin.from(table).delete().gte(filterColumn, 0);
  if (error) {
    throw new Error(`Failed clearing ${table}: ${error.message}`);
  }
}

async function ensureBitewiseTeamAccount() {
  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;

  let teamUser = (listed?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === TEAM_EMAIL);
  if (!teamUser) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: TEAM_EMAIL,
      password: `${crypto.randomUUID()}Bw!9`,
      email_confirm: true,
      user_metadata: { username: TEAM_USERNAME, is_official: true },
    });
    if (createErr || !created.user) {
      throw new Error(`Unable to create Bitewise Team user: ${createErr?.message ?? "unknown"}`);
    }
    teamUser = created.user;
  }

  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      user_id: teamUser.id,
      username: TEAM_USERNAME,
      activity_level: "moderate",
      goal: "maintain",
      timezone: "UTC",
      deletion_requested_at: null,
    },
    { onConflict: "user_id" },
  );
  if (profileErr) {
    throw new Error(`Unable to upsert Bitewise Team profile: ${profileErr.message}`);
  }

  return teamUser.id;
}

async function clearBucket(bucketName) {
  const { data: topEntries } = await admin.storage.from(bucketName).list("", { limit: 200 });
  if (!topEntries || topEntries.length === 0) return;
  for (const entry of topEntries) {
    if (entry.id === null) {
      const { data: nested } = await admin.storage.from(bucketName).list(entry.name, { limit: 200 });
      const paths = (nested ?? []).map((item) => `${entry.name}/${item.name}`);
      if (paths.length > 0) {
        await admin.storage.from(bucketName).remove(paths);
      }
    } else {
      await admin.storage.from(bucketName).remove([entry.name]);
    }
  }
}

async function main() {
  // 1. Clear all dummy/test activity, storage objects, & meal data FIRST while keeping real accounts
  await clearBucket("food-photos");
  await clearBucket("meal-plan-photos");

  await clearTable("meal_plan_items", "id");
  await clearTable("meal_plans", "id");
  await clearTable("weekly_plan_meals", "id");
  await clearTable("weekly_plans", "id");
  await clearTable("food_logs", "id");
  await clearTable("weight_logs", "id");
  await clearTable("exercise_logs", "id");
  await clearTable("badges", "id");
  await clearTable("custom_foods", "id");
  await clearTable("favorite_foods", "id");
  await clearTable("daily_summaries", "user_id");
  await clearTable("streaks", "user_id");
  await clearTable("recalibration_states", "user_id");
  await clearTable("daily_ai_usage", "user_id");

  // 2. Remove automated verification-script test accounts & their profiles
  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;

  const testUsers = (listed?.users ?? []).filter(isAutomatedTestUser);
  let removedTestUsers = 0;
  for (const testUser of testUsers) {
    await admin.from("notification_preferences").delete().eq("user_id", testUser.id);
    await admin.from("profiles").delete().eq("user_id", testUser.id);
    const { error } = await admin.auth.admin.deleteUser(testUser.id);
    if (!error) removedTestUsers += 1;
  }

  const teamUserId = await ensureBitewiseTeamAccount();
  const uploadedUrls = await uploadOfficialMealPhotos();

  const rowsToInsert = BITEWISE_PUBLIC_MEAL_PLANS.map((entry) => {
    const imageUrl = uploadedUrls.get(entry.recipe.title);
    const recipeWithPhoto = imageUrl ? { ...entry.recipe, imageUrl } : entry.recipe;
    return {
      user_id: teamUserId,
      name: entry.recipe.title,
      visibility: "public",
      goal: entry.goal,
      diet_type: entry.diet_type,
      total_calories: entry.recipe.nutrition.calories,
      cook_time_minutes: entry.recipe.cookTimeMinutes,
      nutrition: entry.recipe.nutrition,
      recipe: recipeWithPhoto,
      save_count: 0,
    };
  });

  const { data: inserted, error: insertErr } = await admin
    .from("meal_plans")
    .insert(rowsToInsert)
    .select("id, name, visibility, total_calories");

  if (insertErr) {
    throw new Error(`Failed seeding Bitewise Team meal plans: ${insertErr.message}`);
  }

  const { data: remainingProfiles } = await admin.from("profiles").select("username");
  console.log(
    JSON.stringify(
      {
        removedTestUsers,
        preservedProfiles: (remainingProfiles ?? []).map((p) => p.username),
        seededPublicPlansCount: inserted?.length ?? 0,
        seededTitles: (inserted ?? []).map((p) => p.name),
      },
      null,
      2,
    ),
  );
}

await main();
