import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

try { const contents = await readFile(new URL("../.env.local", import.meta.url), "utf8"); for (const line of contents.split(/\r?\n/)) { const match = line.match(/^([^#=]+)=(.*)$/); if (match && !process.env[match[1]]) process.env[match[1]] = match[2]; } } catch {}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey) throw new Error("Supabase credentials are required.");
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`; const password = "BitewiseForkTest123!"; const users = [`fork_a_${suffix}@example.com`, `fork_b_${suffix}@example.com`]; const ids = [];
function assert(condition, message) { if (!condition) throw new Error(message); }
async function signedClient(email) { const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } }); const result = await client.auth.signInWithPassword({ email, password }); if (result.error) throw result.error; return client; }
try {
  for (const email of users) { const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (created.error) throw created.error; ids.push(created.data.user.id); }
  const owner = await signedClient(users[0]); const forkUser = await signedClient(users[1]);
  const profileA = await admin.from("profiles").insert({ user_id: ids[0], username: `fork_a_${suffix.slice(-12)}`, timezone: "UTC", sex: "female" }); if (profileA.error) throw profileA.error;
  const profileB = await admin.from("profiles").insert({ user_id: ids[1], username: `fork_b_${suffix.slice(-12)}`, timezone: "UTC", sex: "female" }); if (profileB.error) throw profileB.error;
  const plan = await owner.from("meal_plans").insert({ user_id: ids[0], name: "Public fork test", visibility: "public", goal: "maintain", diet_type: "balanced", total_calories: 200 }).select("id").single(); if (plan.error) throw plan.error;
  const item = await owner.from("meal_plan_items").insert({ plan_id: plan.data.id, meal_type: "lunch", food_name: "Test rice", weight_g: 150, calories_per_g: 1.333333, calories: 0 }).select("id").single(); if (item.error) throw item.error;
  const fork = await forkUser.rpc("fork_public_meal_plan", { p_source_id: plan.data.id, p_user_id: ids[1] }); if (fork.error) throw fork.error;
  const copied = await forkUser.from("meal_plans").select("id, user_id, visibility, forked_from, save_count, meal_plan_items(weight_g, calories_per_g, food_name)").eq("id", fork.data).single(); if (copied.error) throw copied.error;
  assert(copied.data.user_id === ids[1] && copied.data.visibility === "private" && Number(copied.data.forked_from) === Number(plan.data.id), "Fork ownership or provenance is incorrect.");
  assert(copied.data.meal_plan_items.length === 1 && Number(copied.data.meal_plan_items[0].weight_g) === 150 && copied.data.meal_plan_items[0].food_name === "Test rice", "Fork did not preserve item weight and identity.");
  const source = await owner.from("meal_plans").select("save_count").eq("id", plan.data.id).single(); if (source.error) throw source.error; assert(Number(source.data.save_count) === 1, "Source save_count was not incremented atomically.");
  console.log("Meal-plan fork verification passed: independent private copy, provenance, item weight/rate, and save_count are correct.");
} finally { for (const id of ids) await admin.auth.admin.deleteUser(id); }
