import { createAdminClient } from "@/lib/supabase/admin";
import { runCronJob } from "@/lib/cron";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) return new Response("Unauthorized", { status: 401 });

  try {
    const result = await runCronJob("purge_photos", async () => {
      const admin = createAdminClient();
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: logs, error } = await admin.from("food_logs").select("id, photo_url").not("photo_url", "is", null).lt("created_at", cutoff).limit(500);
      if (error) throw error;
      let cleared = 0;
      let failed = 0;
      for (const log of logs ?? []) {
        const path = storagePath(log.photo_url);
        const storageResult = path ? await admin.storage.from("food-photos").remove([path]) : { error: null };
        const result = storageResult.error ? storageResult : await admin.from("food_logs").update({ photo_url: null }).eq("id", log.id);
        if (result.error) failed += 1;
        else cleared += 1;
      }
      return { found: logs?.length ?? 0, cleared, failed };
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Photo purge failed." }, { status: 500 });
  }
}

function storagePath(photoUrl: string | null): string | null {
  if (!photoUrl) return null;
  try {
    const path = new URL(photoUrl).pathname;
    const marker = "/food-photos/";
    const index = path.indexOf(marker);
    return index >= 0 ? decodeURIComponent(path.slice(index + marker.length)) : null;
  } catch {
    return null;
  }
}
