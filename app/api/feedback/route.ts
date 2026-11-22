import { apiErrorResponse, parseJson } from "@/lib/api";
import { consumeFeedbackRateLimit } from "@/lib/feedback-rate-limit";
import { createFeedbackSchema, type FeedbackItem } from "@/lib/feedback-schemas";
import {
  insertPublicFeedback,
  listSubmittedFeedbackByIds,
} from "@/lib/feedback-store";
import { claimRateLimit, getTrustedClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function toPublicFeedbackItem(item: FeedbackItem) {
  return {
    id: item.id,
    username: item.username,
    overallRating: item.overallRating,
    focusArea: item.focusArea,
    loggingEase: item.loggingEase,
    mostWanted: item.mostWanted,
    message: item.message,
    status: item.status,
    adminNote: item.adminNote,
    reviewedAt: item.reviewedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function GET(request: Request) {
  try {
    const clientIp = getTrustedClientIp(request);
    await claimRateLimit({
      key: `feedback_read:ip:${clientIp}`,
      windowSeconds: 60,
      limit: 30,
      message: "Too many feedback lookup requests. Please try again shortly.",
    });

    const url = new URL(request.url);
    const rawIds = url.searchParams.get("ids") ?? "";
    const ids = rawIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const items = await listSubmittedFeedbackByIds(ids);
    return Response.json({ items: items.map(toPublicFeedbackItem) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await parseJson(request, createFeedbackSchema);
    const clientIp = getTrustedClientIp(request);
    consumeFeedbackRateLimit(`ip:${clientIp}`);
    await claimRateLimit({
      key: `feedback_post:ip:${clientIp}`,
      windowSeconds: 3600,
      limit: 10,
      message: "You have sent several suggestions recently. Please wait a bit and try again.",
    });

    const senderName = parsed.senderName
      ? parsed.senderName.replace(/^@+/, "")
      : "Guest";

    const item = await insertPublicFeedback({
      userId: null,
      username: senderName || "Guest",
      overallRating: parsed.overallRating,
      focusArea: parsed.focusArea,
      loggingEase: parsed.loggingEase,
      mostWanted: parsed.mostWanted,
      message: parsed.message,
    });

    return Response.json({ item: toPublicFeedbackItem(item) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
