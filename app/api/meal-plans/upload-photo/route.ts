import { z } from "zod";
import { apiErrorResponse, ApiError, parseJson } from "@/lib/api";
import { detectImageMimeFromBytes, IMAGE_MIME_TO_EXT } from "@/lib/image-security";
import { claimRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const BUCKET_NAME = "meal-plan-photos";
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_CONTENT_LENGTH_BYTES = MAX_UPLOAD_BYTES + 256 * 1024;

const deletePhotoSchema = z.object({
  path: z.string().trim().min(3).max(240),
});

function isOwnedMealPhotoPath(path: string, userId: string): boolean {
  const escapedId = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escapedId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`, "i").test(path);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    await claimRateLimit({
      key: `upload_photo:${user.id}`,
      windowSeconds: 3600,
      limit: 30,
      message: "You have uploaded several photos recently. Please wait before uploading more.",
    });

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH_BYTES) {
      throw new ApiError(413, "Photo size must be 3MB or smaller.", "photo_too_large");
    }

    const formData = await request.formData();
    const entry = formData.get("photo");
    if (!(entry instanceof Blob)) {
      throw new ApiError(400, "Attach an image file under 'photo'.", "missing_photo");
    }

    if (entry.size <= 0 || entry.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(400, "Photo size must be 3MB or smaller.", "photo_too_large");
    }

    const bytes = new Uint8Array(await entry.arrayBuffer());
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new ApiError(400, "Photo size must be 3MB or smaller.", "photo_too_large");
    }

    const detectedMime = detectImageMimeFromBytes(bytes);
    if (!detectedMime) {
      throw new ApiError(400, "Choose a valid JPG, PNG, or WebP photo.", "invalid_photo_type");
    }

    const extension = IMAGE_MIME_TO_EXT[detectedMime];
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

    const uploadResult = await supabase.storage.from(BUCKET_NAME).upload(path, bytes, {
      contentType: detectedMime,
      upsert: false,
    });

    if (uploadResult.error) {
      throw new ApiError(500, "Unable to upload photo right now.", "photo_upload_failed");
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    return Response.json({ imageUrl: publicUrlData.publicUrl, path }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Authentication is required.", "unauthorized");

    const { path } = await parseJson(request, deletePhotoSchema);
    if (!isOwnedMealPhotoPath(path, user.id)) {
      throw new ApiError(403, "You can only remove your own uploaded photos.", "forbidden");
    }

    const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
    if (error) {
      throw new ApiError(500, "Unable to remove photo right now.", "photo_delete_failed");
    }

    return Response.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
