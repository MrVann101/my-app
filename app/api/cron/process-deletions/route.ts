import type { SupabaseClient } from "@supabase/supabase-js";
import { isAuthorizedCronRequest, runCronJob } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";

const USER_PHOTO_BUCKETS = ["food-photos", "meal-plan-photos"] as const;

async function purgeUserStorageFolder(
  admin: SupabaseClient,
  bucket: string,
  userId: string,
): Promise<void> {
  try {
    const { data: files, error } = await admin.storage.from(bucket).list(userId, { limit: 500 });
    if (error || !files || files.length === 0) return;
    const paths = files
      .map((file) => file.name)
      .filter((name) => Boolean(name) && !name.includes(".."))
      .map((name) => `${userId}/${name}`);
    if (paths.length > 0) {
      await admin.storage.from(bucket).remove(paths);
    }
  } catch {
    // Missing bucket or empty folder should not block account deletion.
  }
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runCronJob("process_deletions", async () => {
      const admin = createAdminClient();
      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: profiles, error } = await admin
        .from("profiles")
        .select("user_id")
        .not("deletion_requested_at", "is", null)
        .lte("deletion_requested_at", cutoff)
        .limit(100);

      if (error) throw error;
      let deleted = 0;
      let failed = 0;

      for (const profile of profiles ?? []) {
        for (const bucket of USER_PHOTO_BUCKETS) {
          await purgeUserStorageFolder(admin, bucket, profile.user_id);
        }
        const deleteResult = await admin.auth.admin.deleteUser(profile.user_id);
        if (deleteResult.error) failed += 1;
        else deleted += 1;
      }

      return { found: profiles?.length ?? 0, deleted, failed };
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Account deletion processing failed." }, { status: 500 });
  }
}
