export type AllowedImageMime = "image/jpeg" | "image/png" | "image/webp";

export const IMAGE_MIME_TO_EXT: Record<AllowedImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Inspects actual file header magic bytes instead of trusting client-declared MIME types.
 */
export function detectImageMimeFromBytes(bytes: Uint8Array): AllowedImageMime | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF" + 4-byte size + "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

const LOCAL_MEAL_IMAGE_RE = /^\/meals\/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/i;

/**
 * Allows only local bundled `/meals/*` photos or HTTPS URLs hosted on Bitewise's
 * Supabase `meal-plan-photos` public bucket. Prevents arbitrary external tracking
 * URLs, javascript:/data: schemes, and path traversal.
 */
export function isSafeMealPlanImageUrl(
  rawUrl: string | null | undefined,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) return false;

  if (LOCAL_MEAL_IMAGE_RE.test(trimmed)) {
    return !trimmed.includes("..");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    return false;
  }

  if (decodedPath.includes("..") || decodedPath.includes("\\")) return false;
  if (!decodedPath.startsWith("/storage/v1/object/public/meal-plan-photos/")) {
    return false;
  }

  if (supabaseUrl) {
    try {
      const expectedOrigin = new URL(supabaseUrl).origin;
      return parsed.origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  // Fallback when NEXT_PUBLIC_SUPABASE_URL is unset (e.g. isolated unit tests).
  return parsed.hostname.endsWith(".supabase.co");
}

/**
 * Validates that a food log photo URL belongs strictly to Bitewise's Supabase
 * `food-photos` bucket under the caller's own `${userId}/` folder prefix.
 */
export function isSafeFoodPhotoUrl(
  rawUrl: string | null | undefined,
  userId: string,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): boolean {
  if (!rawUrl || typeof rawUrl !== "string" || !userId) return false;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;

  if (supabaseUrl) {
    try {
      if (parsed.origin !== new URL(supabaseUrl).origin) return false;
    } catch {
      return false;
    }
  } else if (!parsed.hostname.endsWith(".supabase.co")) {
    return false;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    return false;
  }

  if (decodedPath.includes("..") || decodedPath.includes("\\")) return false;

  const marker = "/food-photos/";
  const idx = decodedPath.indexOf(marker);
  if (idx < 0) return false;

  const prefix = decodedPath.slice(0, idx);
  if (
    prefix !== "/storage/v1/object/public" &&
    prefix !== "/storage/v1/object/sign" &&
    prefix !== "/storage/v1/object/authenticated"
  ) {
    return false;
  }

  const objectKey = decodedPath.slice(idx + marker.length);
  return objectKey.startsWith(`${userId}/`) && objectKey.length > userId.length + 1;
}

/**
 * Escapes PostgreSQL LIKE/ILIKE metacharacters so user input matches literally.
 */
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
