import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { ApiError, apiErrorResponse, parseJson } from "@/lib/api";

const planIdSchema = z.coerce.number().int().positive();

const moderatePlanSchema = z.object({
  visibility: z.literal("private"),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { admin } = await requireAdmin();
    const { id: rawId } = await context.params;
    const parsedId = planIdSchema.safeParse(rawId);
    if (!parsedId.success) {
      throw new ApiError(400, "Invalid meal plan identifier.", "invalid_id");
    }

    const { visibility } = await parseJson(request, moderatePlanSchema);

    const { data, error } = await admin
      .from("meal_plans")
      .update({ visibility })
      .eq("id", parsedId.data)
      .eq("visibility", "public")
      .select("id, visibility")
      .maybeSingle();

    if (error) {
      throw new ApiError(400, "Unable to update meal plan visibility.", "plan_moderation_failed");
    }
    if (!data) {
      throw new ApiError(404, "Public meal plan not found.", "not_found");
    }

    return Response.json({ id: data.id, visibility: data.visibility });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { admin } = await requireAdmin();
    const { id: rawId } = await context.params;
    const parsedId = planIdSchema.safeParse(rawId);
    if (!parsedId.success) {
      throw new ApiError(400, "Invalid meal plan identifier.", "invalid_id");
    }

    const { data, error } = await admin
      .from("meal_plans")
      .delete()
      .eq("id", parsedId.data)
      .eq("visibility", "public")
      .select("id");

    if (error) {
      throw new ApiError(400, "Unable to delete public meal plan.", "plan_delete_failed");
    }
    if (!data || data.length === 0) {
      throw new ApiError(404, "Public meal plan not found.", "not_found");
    }

    return Response.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
