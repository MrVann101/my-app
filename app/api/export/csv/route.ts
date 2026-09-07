import { apiErrorResponse, ApiError } from "@/lib/api";
import { csvRow } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

const tables = ["food_logs", "daily_summaries", "weight_logs", "exercise_logs", "meal_plans", "favorite_foods", "custom_foods", "badges"] as const;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");
    const results = await Promise.all(tables.map((table) => supabase.from(table).select("*").eq("user_id", user.id)));
    const failed = results.find((result) => result.error);
    if (failed?.error) throw new ApiError(400, failed.error.message, "export_failed");
    const plans = results[tables.indexOf("meal_plans")].data ?? [];
    const planIds = plans.map((plan) => (plan as { id: number }).id);
    const itemResult = planIds.length > 0 ? await supabase.from("meal_plan_items").select("*").in("plan_id", planIds) : { data: [], error: null };
    if (itemResult.error) throw new ApiError(400, itemResult.error.message, "export_failed");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(csvRow(["table", "id", "data"])));
        results.forEach((result, index) => {
          const table = tables[index];
          for (const row of result.data ?? []) controller.enqueue(encoder.encode(csvRow([table, (row as { id?: unknown }).id ?? "", JSON.stringify(row)])));
        });
        for (const row of itemResult.data ?? []) controller.enqueue(encoder.encode(csvRow(["meal_plan_items", (row as { id?: unknown }).id ?? "", JSON.stringify(row)])));
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bitewise-export-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
