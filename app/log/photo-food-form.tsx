"use client";

import { useRef, useState } from "react";
import { computeNutrients } from "@/lib/food";
import type { AiTextEstimate } from "@/lib/types";
import { IconCamera, IconUpload, IconShieldCheck, IconCheck } from "@/components/icons";

type PermissionTarget = "camera" | "gallery" | null;

export default function PhotoFoodForm() {
  const [items, setItems] = useState<AiTextEstimate[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingPermission, setPendingPermission] = useState<PermissionTarget>(null);
  const [mealType, setMealType] = useState("snack");

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  function requestPermission(target: "camera" | "gallery") {
    setError(null);
    setStatus(null);
    setPendingPermission(target);
  }

  function cancelPermission() {
    setPendingPermission(null);
  }

  async function handlePermissionGranted() {
    const target = pendingPermission;
    setPendingPermission(null);

    if (target === "camera") {
      // Attempt browser camera permission check if supported
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          // Stop stream immediately after permission granted, then open input
          stream.getTracks().forEach((track) => track.stop());
        } catch {
          // Fall back to triggering native input capture directly
        }
      }
      cameraInputRef.current?.click();
    } else if (target === "gallery") {
      galleryInputRef.current?.click();
    }
  }

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setError(null);
    setStatus(null);
    setItems([]);

    // Set local image thumbnail preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    setIsAnalyzing(true);
    const body = new FormData();
    body.set("image", file);
    try {
      const response = await fetch("/api/food/analyze-photo", { method: "POST", body });
      const payload = await response.json();
      setIsAnalyzing(false);
      if (!response.ok) {
        setError(payload.error?.message ?? "Photo analysis is unavailable. Use search or manual entry instead.");
        return;
      }
      setItems(payload.items);
      setProvider(payload.providerUsed);
    } catch {
      setIsAnalyzing(false);
      setError("Unable to complete photo analysis.");
    }
  }

  function updateWeight(index: number, weight: number) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, estimatedWeightG: Math.max(1, weight || 1) } : item
      )
    );
  }

  async function saveAllLogs() {
    if (items.length === 0) return;
    setError(null);
    setStatus(null);
    let successCount = 0;

    for (const item of items) {
      const response = await fetch("/api/food/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate: new Date().toISOString().slice(0, 10),
          mealType,
          foodName: item.foodName,
          weightG: item.estimatedWeightG,
          nutrientRate: item.nutrientRate,
          source: "ai_photo",
          dataSource: provider,
          aiConfidence: item.confidence,
        }),
      });
      if (response.ok) successCount++;
    }

    if (successCount > 0) {
      setStatus(`✓ Logged ${successCount} photo estimated meal(s) to today's journal!`);
      setItems([]);
      setPreviewUrl(null);
    } else {
      setError("Unable to save photo food logs.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Hidden File Inputs */}
      <input
        ref={cameraInputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(event) => handleImage(event.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => handleImage(event.target.files?.[0])}
      />

      {/* Permission Request Dialog Modal / Card */}
      {pendingPermission ? (
        <div className="rounded-2xl border border-[var(--leaf)]/40 bg-[var(--leaf-light)] p-5 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[var(--leaf)] text-white shrink-0">
              <IconShieldCheck className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--leaf-deep)]">
                {pendingPermission === "camera" ? "Camera Permission Required" : "Photo Gallery Permission Required"}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">
                Bitewise requests permission to {pendingPermission === "camera" ? "access your device camera to take a photo of your meal" : "select a meal photo from your photo library"}. Photos are analyzed with AI vision and automatically deleted after 30 days.
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-[var(--leaf)]/20">
            <button
              type="button"
              onClick={cancelPermission}
              className="active-press rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-xs font-bold text-[var(--ink-muted)] hover:bg-[var(--surface-muted)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handlePermissionGranted()}
              className="active-press inline-flex items-center gap-2 rounded-xl bg-[var(--leaf)] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[var(--leaf-deep)]"
            >
              <IconCheck className="size-4" />
              <span>Allow & Continue</span>
            </button>
          </div>
        </div>
      ) : (
        /* Action Buttons Choice Screen */
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => requestPermission("camera")}
            disabled={isAnalyzing}
            className="active-press flex flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center shadow-xs transition-all hover:border-[var(--leaf)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-[var(--leaf-light)] text-[var(--leaf)]">
              <IconCamera className="size-6" />
            </div>
            <strong className="mt-3 text-sm font-bold text-[var(--foreground)]">Take Photo with Camera</strong>
            <span className="mt-1 text-xs text-[var(--ink-muted)]">Opens live camera capture</span>
          </button>

          <button
            type="button"
            onClick={() => requestPermission("gallery")}
            disabled={isAnalyzing}
            className="active-press flex flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center shadow-xs transition-all hover:border-[var(--leaf)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-[var(--leaf-light)] text-[var(--leaf)]">
              <IconUpload className="size-6" />
            </div>
            <strong className="mt-3 text-sm font-bold text-[var(--foreground)]">Upload from Gallery</strong>
            <span className="mt-1 text-xs text-[var(--ink-muted)]">Choose JPEG, PNG, or WebP</span>
          </button>
        </div>
      )}

      {/* Image Thumbnail Preview & Loading State */}
      {previewUrl && (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Meal preview" className="size-20 rounded-xl object-cover border border-[var(--line)]" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--leaf)]">Selected Image</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {isAnalyzing ? "Analyzing meal composition..." : "Photo loaded ready for review"}
            </p>
            {isAnalyzing && <p className="mt-1 text-xs text-[var(--ink-muted)] animate-pulse">Running AI vision model...</p>}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/10 p-4 text-xs font-bold text-[var(--coral)]" role="alert">
          {error}
        </p>
      )}

      {status && (
        <p className="rounded-xl border border-[var(--leaf)]/30 bg-[var(--leaf-light)] p-4 text-xs font-bold text-[var(--leaf-deep)]" role="status">
          {status}
        </p>
      )}

      {/* Parsed AI Estimates Review */}
      {items.length > 0 && (
        <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)]">Review AI Meal Estimate</h3>
              <p className="text-xs text-[var(--ink-muted)]">Adjust weights before logging</p>
            </div>
            <span className="rounded-full bg-[var(--leaf-light)] px-3 py-1 text-xs font-bold text-[var(--leaf)] uppercase">
              AI Vision · {provider}
            </span>
          </div>

          <label className="block text-xs font-bold uppercase text-[var(--ink-muted)]">
            Meal Event
            <select
              className="mt-1.5 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm font-semibold outline-none focus:border-[var(--leaf)]"
              value={mealType}
              onChange={(event) => setMealType(event.target.value)}
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </label>

          <div className="space-y-3">
            {items.map((item, index) => {
              const totals = computeNutrients(item.estimatedWeightG, item.nutrientRate);
              return (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4" key={`${item.foodName}-${index}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-[var(--foreground)]">{item.foodName}</p>
                      <span className="text-xs text-[var(--ink-muted)]">
                        Confidence: {item.confidence} · {item.nutrientRate.caloriesPerG.toFixed(2)} cal/g
                      </span>
                    </div>
                    <span className="tabular-nums text-sm font-bold text-[var(--foreground)]">
                      {Math.round(totals.calories)} kcal
                    </span>
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-[var(--ink-muted)]">
                      Portion Weight (g)
                      <input
                        className="tabular-nums mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-bold outline-none focus:border-[var(--leaf)]"
                        min="1"
                        max="100000"
                        type="number"
                        value={item.estimatedWeightG}
                        onChange={(event) => updateWeight(index, Number(event.target.value))}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void saveAllLogs()}
            className="active-press h-12 w-full rounded-xl bg-[var(--leaf)] text-sm font-bold text-white shadow-xs hover:bg-[var(--leaf-deep)]"
          >
            Log Confirmed Items to Today&apos;s Journal
          </button>
        </div>
      )}
    </div>
  );
}
