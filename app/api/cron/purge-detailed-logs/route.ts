import { isAuthorizedCronRequest, runCronJob } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 200;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runCronJob("purge_detailed_logs", async () => {
      const admin = createAdminClient();
      let processed = 0;
      let deleted = 0;
      let failed = 0;
      let offset = 0;

      while (true) {
        const { data: profiles, error } = await admin
          .from("profiles")
          .select("user_id, timezone")
          .order("user_id", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        const batch = profiles ?? [];
        if (batch.length === 0) break;

        for (const profile of batch) {
          const cutoff = dateOffset(previousLocalDate(profile.timezone ?? "UTC"), -30);
          const deleteRes = await admin
            .from("food_logs")
            .delete()
            .eq("user_id", profile.user_id)
            .lt("log_date", cutoff)
            .select("id");
          processed += 1;
          if (deleteRes.error) failed += 1;
          else deleted += deleteRes.data?.length ?? 0;
        }

        if (batch.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      return { processed, deleted, failed };
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Detailed-log purge failed." }, { status: 500 });
  }
}

function previousLocalDate(timezone: string): string {
  const now = new Date();
  let safeTimezone = "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
    safeTimezone = timezone;
  } catch {
    safeTimezone = "UTC";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
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
