import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(__dirname, "../.env.local");

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

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET_NAME = "meal-plan-photos";
const TEAM_USERNAME = "Bitewise Team";

export const OFFICIAL_PLAN_PHOTO_SLUGS = [
  { title: "High-Protein Chicken Tinola Bowl", slug: "chicken-tinola-bowl" },
  { title: "Mediterranean Herb Salmon & Quinoa", slug: "mediterranean-herb-salmon-quinoa" },
  { title: "Greek Yogurt Berry Protein Parfait", slug: "greek-yogurt-berry-protein-parfait" },
  { title: "Lean Beef & Broccoli Garlic Stir-Fry", slug: "lean-beef-broccoli-garlic-stir-fry" },
  { title: "Crispy Tofu & Edamame Sesame Bowl", slug: "crispy-tofu-edamame-sesame-bowl" },
  { title: "Garlic Lemon Chicken Adobo (Light)", slug: "garlic-lemon-chicken-adobo-light" },
  { title: "Turkey, Spinach & Feta Egg White Wrap", slug: "turkey-spinach-feta-egg-white-wrap" },
  { title: "Creamy Peanut Banana Overnight Oats", slug: "creamy-peanut-banana-overnight-oats" },
  { title: "Sheet-Pan Garlic Shrimp & Sweet Potato", slug: "sheet-pan-garlic-shrimp-sweet-potato" },
  { title: "Roasted Chickpea & Avocado Power Salad", slug: "roasted-chickpea-avocado-power-salad" },
];

export async function ensurePublicMealPhotosBucket() {
  const { data: buckets, error: listErr } = await admin.storage.listBuckets();
  if (listErr) throw new Error(`Failed listing storage buckets: ${listErr.message}`);

  const existing = (buckets ?? []).find((bucket) => bucket.name === BUCKET_NAME);
  if (!existing) {
    const { error: createErr } = await admin.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 3 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (createErr) throw new Error(`Failed creating ${BUCKET_NAME}: ${createErr.message}`);
  } else if (!existing.public) {
    const { error: updateErr } = await admin.storage.updateBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 3 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (updateErr) throw new Error(`Failed marking ${BUCKET_NAME} public: ${updateErr.message}`);
  }
}

export async function uploadOfficialMealPhotos() {
  await ensurePublicMealPhotosBucket();
  const mealsDir = path.resolve(__dirname, "../public/meals");
  const uploadedUrls = new Map();

  for (const { title, slug } of OFFICIAL_PLAN_PHOTO_SLUGS) {
    const filePath = path.join(mealsDir, `${slug}.jpg`);
    const bytes = await readFile(filePath);
    const storagePath = `official/${slug}.jpg`;

    const { error: uploadErr } = await admin.storage.from(BUCKET_NAME).upload(storagePath, bytes, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: true,
    });
    if (uploadErr) {
      throw new Error(`Failed uploading ${storagePath}: ${uploadErr.message}`);
    }

    const { data } = admin.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    uploadedUrls.set(title, data.publicUrl);
  }

  return uploadedUrls;
}

async function main() {
  const uploadedUrls = await uploadOfficialMealPhotos();

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("user_id, username")
    .eq("username", TEAM_USERNAME)
    .maybeSingle();

  if (profileErr || !profile) {
    throw new Error(`Unable to find "${TEAM_USERNAME}" profile: ${profileErr?.message ?? "missing"}`);
  }

  const { data: plans, error: plansErr } = await admin
    .from("meal_plans")
    .select("id, name, recipe")
    .eq("user_id", profile.user_id)
    .eq("visibility", "public");

  if (plansErr) {
    throw new Error(`Failed loading public meal plans: ${plansErr.message}`);
  }

  const results = [];
  for (const plan of plans ?? []) {
    const imageUrl = uploadedUrls.get(plan.name);
    if (!imageUrl || !plan.recipe) continue;

    const updatedRecipe = { ...plan.recipe, imageUrl };
    const { error: updateErr } = await admin
      .from("meal_plans")
      .update({ recipe: updatedRecipe })
      .eq("id", plan.id);

    if (updateErr) {
      throw new Error(`Failed updating imageUrl for "${plan.name}": ${updateErr.message}`);
    }

    const headResp = await fetch(imageUrl, { method: "HEAD" });
    if (!headResp.ok) {
      throw new Error(`Public photo URL check failed (${headResp.status}) for "${plan.name}": ${imageUrl}`);
    }

    results.push({
      id: plan.id,
      name: plan.name,
      status: headResp.status,
      contentType: headResp.headers.get("content-type"),
      imageUrl,
    });
  }

  console.log(
    JSON.stringify(
      {
        updatedCount: results.length,
        plans: results,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
