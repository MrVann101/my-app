const ALLOWED_INPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_RAW_INPUT_BYTES = 12 * 1024 * 1024;
const DIRECT_UPLOAD_THRESHOLD_BYTES = 1.2 * 1024 * 1024;
const MAX_DIMENSION_PX = 1280;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read the selected image."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/** Validate and compress large camera photos client-side so meal plan uploads stay fast and under 3MB. */
export async function prepareMealPhotoFile(file: File): Promise<File> {
  if (!ALLOWED_INPUT_TYPES.has(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP photo.");
  }
  if (file.size <= 0) {
    throw new Error("The selected photo file is empty.");
  }
  if (file.size > MAX_RAW_INPUT_BYTES) {
    throw new Error("Choose a photo smaller than 12MB.");
  }

  if (file.size <= DIRECT_UPLOAD_THRESHOLD_BYTES) {
    return file;
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const outputType = "image/jpeg";
  const blob = await canvasToBlob(canvas, outputType, 0.85);
  if (!blob || blob.size >= file.size) {
    if (file.size > 3 * 1024 * 1024) {
      const tighterBlob = await canvasToBlob(canvas, outputType, 0.72);
      if (tighterBlob && tighterBlob.size <= 3 * 1024 * 1024) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || "meal-photo";
        return new File([tighterBlob], `${baseName}.jpg`, { type: outputType });
      }
      throw new Error("Photo is too large even after compression. Choose a smaller image.");
    }
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "meal-photo";
  return new File([blob], `${baseName}.jpg`, { type: outputType });
}

export async function uploadMealPlanPhoto(file: File): Promise<{ imageUrl: string; path: string }> {
  const prepared = await prepareMealPhotoFile(file);
  const formData = new FormData();
  formData.set("photo", prepared);

  const response = await fetch("/api/meal-plans/upload-photo", {
    method: "POST",
    body: formData,
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
        ? (payload as { error: { message: string } }).error.message
        : "Unable to upload meal photo.";
    throw new Error(message);
  }

  const record = payload as { imageUrl?: unknown; path?: unknown };
  if (typeof record.imageUrl !== "string" || typeof record.path !== "string") {
    throw new Error("Meal photo upload returned an invalid response.");
  }

  return { imageUrl: record.imageUrl, path: record.path };
}

export async function removeUploadedMealPlanPhoto(path: string): Promise<void> {
  await fetch("/api/meal-plans/upload-photo", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  }).catch(() => {});
}
