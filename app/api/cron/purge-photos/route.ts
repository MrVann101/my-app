import { isAuthorizedCronRequest, runCronJob } from "@/lib/cron";
import { isSafeFoodPhotoUrl } from "@/lib/image-security";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runCronJob("purge_photos", async () => {
      const admin = createAdminClient();
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: logs, error } = await admin
        .from("food_logs")
        .select("id, user_id, photo_url")
        .not("photo_url", "is", null)
        .lt("created_at", cutoff)
        .limit(500);

      if (error) throw error;
      let cleared = 0;
      let failed = 0;

      for (const log of logs ?? []) {
        const path = ownedFoodPhotoStoragePath(log.photo_url, log.user_id);
        const storageResult = path
          ? await admin.storage.from("food-photos").remove([path])
          : { error: null };
        const updateResult = storageResult.error
          ? storageResult
          : await admin.from("food_logs").update({ photo_url: null }).eq("id", log.id);
        if (updateResult.error) failed += 1;
        else cleared += 1;
      }

      return { found: logs?.length ?? 0, cleared, failed };
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Photo purge failed." }, { status: 500 });
  }
}

function ownedFoodPhotoStoragePath(photoUrl: string | null, userId: string): string | null {
  if (!isSafeFoodPhotoUrl(photoUrl, userId)) return null;
  try {
    const decodedPath = decodeURIComponent(new URL(photoUrl!).pathname);
    const marker = "/food-photos/";
    const index = decodedPath.indexOf(marker);
    if (index < 0) return null;
    const objectKey = decodedPath.slice(index + marker.length);
    if (!objectKey.startsWith(`${userId}/`) || objectKey.includes("..") || objectKey.includes("\\")) {
      return null;
    }
    return objectKey;
  } catch {
    return null;
  }
}
