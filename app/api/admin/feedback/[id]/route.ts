import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { ApiError, apiErrorResponse, parseJson } from "@/lib/api";
import { updateFeedbackAdminSchema } from "@/lib/feedback-schemas";
import {
  deleteFeedbackForAdmin,
  updateFeedbackForAdmin,
} from "@/lib/feedback-store";

const feedbackIdSchema = z.string().uuid();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { admin } = await requireAdmin();
    const { id: rawId } = await context.params;
    const parsedId = feedbackIdSchema.safeParse(rawId);
    if (!parsedId.success) {
      throw new ApiError(400, "Invalid suggestion identifier.", "invalid_id");
    }

    const patch = await parseJson(request, updateFeedbackAdminSchema);

    const updated = await updateFeedbackForAdmin(admin, parsedId.data, patch);
    if (!updated) {
      throw new ApiError(404, "Suggestion entry not found.", "not_found");
    }

    return Response.json({ item: updated });
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
    const parsedId = feedbackIdSchema.safeParse(rawId);
    if (!parsedId.success) {
      throw new ApiError(400, "Invalid suggestion identifier.", "invalid_id");
    }

    const deleted = await deleteFeedbackForAdmin(admin, parsedId.data);
    if (!deleted) {
      throw new ApiError(404, "Suggestion entry not found.", "not_found");
    }

    return Response.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
