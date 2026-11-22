import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const envFile = new URL("../.env.local", import.meta.url);
try {
  const contents = await readFile(envFile, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {
  // Environment variables provided externally.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const listOnly = args.includes("--list") || args.length === 0;
const targetArg = args.find((a) => !a.startsWith("--"));

const users = [];
for (let page = 1; page <= 25; page += 1) {
  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({
    page,
    perPage: 200,
  });
  if (listErr) throw new Error(listErr.message);
  const batch = usersPage?.users ?? [];
  users.push(...batch);
  if (batch.length < 200) break;
}

if (listOnly || !targetArg) {
  console.log("Bitewise Accounts:");
  for (const u of users) {
    const uname = u.user_metadata?.username ?? u.email ?? u.id;
    const flag = u.app_metadata?.is_admin === true ? " [ADMIN]" : "";
    console.log(` - ${uname}${flag} (${u.id})`);
  }
  console.log("\nUsage: npm --prefix my-app run grant:admin -- <username> [--revoke]");
} else {
  const needle = targetArg.trim().toLowerCase();
  const match = users.find((u) => {
    const uname = String(u.user_metadata?.username ?? "").toLowerCase();
    const email = String(u.email ?? "").toLowerCase();
    return uname === needle || email === needle || u.id.toLowerCase() === needle;
  });

  if (!match) {
    console.error(`No account found matching "${targetArg}". Run with --list to see usernames.`);
    process.exitCode = 1;
  } else {
    const nextIsAdmin = !revoke;
    const cleanedUserMeta = { ...(match.user_metadata ?? {}) };
    delete cleanedUserMeta.is_admin;

    const { error: updateAuthErr } = await admin.auth.admin.updateUserById(match.id, {
      app_metadata: {
        ...(match.app_metadata ?? {}),
        is_admin: nextIsAdmin,
      },
      user_metadata: cleanedUserMeta,
    });
    if (updateAuthErr) throw new Error(updateAuthErr.message);

    await admin
      .from("profiles")
      .update({ is_admin: nextIsAdmin })
      .eq("user_id", match.id);

    const displayName = match.user_metadata?.username ?? match.email ?? match.id;
    console.log(
      nextIsAdmin
        ? `Granted Admin access to @${displayName} (${match.id}).`
        : `Revoked Admin access from @${displayName} (${match.id}).`,
    );
  }
}
