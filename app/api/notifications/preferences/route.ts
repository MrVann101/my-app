import { z } from "zod";
import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const preferencesSchema = z.object({ emailEnabled: z.boolean(), frequency: z.enum(["off", "daily", "weekly"]), reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Reminder time must use HH:MM."), timezone: z.string().min(1).max(100) });

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await currentUser();
    const { data: preferences, error } = await supabase.from("notification_preferences").select("email_enabled, frequency, reminder_time, timezone").eq("user_id", user.id).maybeSingle();
    if (error) throw new ApiError(400, error.message, "notification_preferences_fetch_failed");
    return Response.json({ preferences: preferences ?? { email_enabled: false, frequency: "off", reminder_time: "19:00", timezone: "UTC" } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    const { supabase, user } = await currentUser();
    const body = await parseJson(request, preferencesSchema);
    try { new Intl.DateTimeFormat("en-US", { timeZone: body.timezone }).format(); } catch { throw new ApiError(400, "Timezone must be a valid IANA timezone.", "invalid_timezone"); }
    const { data: preferences, error } = await supabase.from("notification_preferences").upsert({ user_id: user.id, email_enabled: body.emailEnabled, frequency: body.frequency, reminder_time: `${body.reminderTime}:00`, timezone: body.timezone, updated_at: new Date().toISOString() }).select("email_enabled, frequency, reminder_time, timezone").single();
    if (error) throw new ApiError(400, error.message, "notification_preferences_save_failed");
    return Response.json({ preferences });
  } catch (error) { return apiErrorResponse(error); }
}
