import { isAuthorizedCronRequest, runCronJob } from "@/lib/cron";
import { sendDeletionReminder } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { isInternalAuthEmail } from "@/lib/username-auth";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runCronJob("deletion_reminders", async () => {
      const admin = createAdminClient();
      const now = Date.now();
      const lower = new Date(now - 13 * 24 * 60 * 60 * 1000).toISOString();
      const upper = new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString();
      const { data: profiles, error } = await admin
        .from("profiles")
        .select("user_id, deletion_requested_at")
        .not("deletion_requested_at", "is", null)
        .gte("deletion_requested_at", lower)
        .lt("deletion_requested_at", upper)
        .limit(100);

      if (error) throw error;
      let sent = 0;
      let failed = 0;

      for (const profile of profiles ?? []) {
        const user = await admin.auth.admin.getUserById(profile.user_id);
        const deletionDate = new Date(
          new Date(profile.deletion_requested_at).getTime() + 14 * 24 * 60 * 60 * 1000,
        )
          .toISOString()
          .slice(0, 10);
        const email = user.data.user?.email;
        if (email && !isInternalAuthEmail(email)) {
          try {
            const delivered = await sendDeletionReminder(email, deletionDate);
            if (delivered) sent += 1;
          } catch {
            failed += 1;
          }
        }
      }

      return { found: profiles?.length ?? 0, sent, failed };
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Deletion reminder job failed." }, { status: 500 });
  }
}
