"use client";

import AppShell from "@/components/app-shell";
import PhotoFoodForm from "@/app/log/photo-food-form";

export default function PhotoPage() {
  return (
    <AppShell eyebrow="AI Vision" title="Photo AI">
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs sm:p-8">
          <PhotoFoodForm />
        </div>
      </div>
    </AppShell>
  );
}
