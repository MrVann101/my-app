import { createAdminClient } from "@/lib/supabase/admin";
import { runCronJob } from "@/lib/cron";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) return new Response("Unauthorized", { status: 401 });

  try {
    const result = await runCronJob("purge_detailed_logs", async () => {
      const admin = createAdminClient();
      const { data: profiles, error } = await admin.from("profiles").select("user_id, timezone");
      if (error) throw error;
      let deleted = 0;
      let failed = 0;
      for (const profile of profiles ?? []) {
        const cutoff = dateOffset(previousLocalDate(profile.timezone ?? "UTC"), -30);
        const result = await admin.from("food_logs").delete().eq("user_id", profile.user_id).lt("log_date", cutoff).select("id");
        if (result.error) failed += 1;
        else deleted += result.data?.length ?? 0;
      }
      return { processed: profiles?.length ?? 0, deleted, failed };
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Detailed-log purge failed." }, { status: 500 });
  }
}

function previousLocalDate(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(`${values.year}-${values.month}-${values.day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function dateOffset(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
