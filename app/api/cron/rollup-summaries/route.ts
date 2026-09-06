import { createAdminClient } from "@/lib/supabase/admin";
import { runCronJob } from "@/lib/cron";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) return new Response("Unauthorized", { status: 401 });

  try {
    const result = await runCronJob("rollup_summaries", async () => {
      const admin = createAdminClient();
      const { data: profiles, error } = await admin.from("profiles").select("user_id, timezone");
      if (error) throw error;
      const results = await Promise.all((profiles ?? []).map(async (profile) => {
        const summaryDate = previousLocalDate(profile.timezone ?? "UTC");
        const rollup = await admin.rpc("rollup_daily_summary", { p_user_id: profile.user_id, p_summary_date: summaryDate });
        return { summaryDate, ok: !rollup.error };
      }));
      return { processed: results.length, failed: results.filter((item) => !item.ok).length };
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Summary rollup failed." }, { status: 500 });
  }
}

function previousLocalDate(timezone: string): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(`${values.year}-${values.month}-${values.day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}