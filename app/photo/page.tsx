"use client";

import AppShell from "@/components/app-shell";
import PhotoFoodForm from "@/app/log/photo-food-form";

export default function PhotoPage() {
  return (
    <AppShell eyebrow="AI Vision" title="Photo AI Food Analysis">
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-8">
          <div className="border-b border-[var(--line)] pb-4 mb-6">
            <h2 className="text-base font-bold text-[var(--foreground)]">Snap or Upload Your Meal</h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Use your camera or photo library. Bitewise uses AI vision to estimate ingredients and food items.
            </p>
          </div>
          <PhotoFoodForm />
        </div>
      </div>
    </AppShell>
  );
}
