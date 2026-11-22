import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

try {
  const contents = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseUrl = process.env.BITEWISE_TEST_BASE_URL ?? "http://localhost:3100";
const cronSecret = process.env.CRON_SECRET ?? "photo-test-secret";
if (!url || !serviceRoleKey) throw new Error("Supabase URL and service-role key are required.");
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
const path = `verification/${suffix}.jpg`;
let userId;
function assert(condition, message) { if (!condition) throw new Error(message); }

try {
  const buckets = await admin.storage.listBuckets();
  if (buckets.error) throw buckets.error;
  const bucket = buckets.data.find((item) => item.name === "food-photos");
  assert(bucket, "The food-photos Storage bucket does not exist; create it before enabling photo cleanup.");

  const created = await admin.auth.admin.createUser({ email: `photo_purge_${suffix}@example.com`, password: "BitewisePhotoPurgeTest123!", email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const ownedPath = `${userId}/${suffix}.jpg`;
  const upload = await admin.storage.from("food-photos").upload(ownedPath, new Uint8Array([255, 216, 255, 216]), { contentType: "image/jpeg" });
  if (upload.error) throw upload.error;
  const supabaseOrigin = new URL(url).origin;
  const log = await admin.from("food_logs").insert({ user_id: userId, log_date: "2026-08-01", food_name: "Old photo", weight_g: 100, calories_per_g: 1, calories: 100, photo_url: `${supabaseOrigin}/storage/v1/object/public/food-photos/${ownedPath}` }).select("id").single();
  if (log.error) throw log.error;
  const oldCreated = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const moved = await admin.from("food_logs").update({ created_at: oldCreated }).eq("id", log.data.id);
  if (moved.error) throw moved.error;

  const response = await fetch(`${baseUrl}/api/cron/purge-photos`, { headers: { Authorization: `Bearer ${cronSecret}` } });
  const payload = await response.json();
  assert(response.ok, `Photo purge route failed: ${response.status}`);
  const object = await admin.storage.from("food-photos").download(ownedPath);
  assert(object.error, "Expired photo object still exists after purge.");
  const row = await admin.from("food_logs").select("photo_url").eq("id", log.data.id).single();
  if (row.error) throw row.error;
  assert(row.data.photo_url === null, "Expired photo_url was not cleared.");
  console.log(`Photo purge verification passed: ${payload.cleared} expired photo reference cleared and object removed.`);
} finally {
  await admin.storage.from("food-photos").remove([path]);
  if (userId) await admin.auth.admin.deleteUser(userId);
}
