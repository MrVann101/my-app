"use client";

import { useEffect, useState } from "react";
import { IconMealPlans, IconCheck, IconRefresh, IconFork } from "@/components/icons";

type Plan = {
  id: number;
  name: string;
  creator_username: string;
  goal: string | null;
  diet_type: string | null;
  total_calories: number;
  save_count: number;
  meal_plan_items: { food_name: string; weight_g: number }[];
};

const CREATOR_GRADIENTS = [
  "from-[var(--sky)] to-[var(--leaf)]",
  "from-emerald-500 to-teal-700",
  "from-violet-500 to-purple-700",
  "from-amber-400 to-rose-600",
  "from-pink-500 to-rose-700",
  "from-indigo-500 to-cyan-600",
];

function getCreatorGradient(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash << 5) - hash + username.charCodeAt(i);
    hash |= 0;
  }
  return CREATOR_GRADIENTS[Math.abs(hash) % CREATOR_GRADIENTS.length];
}

function getCreatorInitials(username: string) {
  const clean = username.replace(/^@/, "").replace(/[^a-zA-Z0-9]/g, "");
  if (!clean) return "BW";
  if (clean.length <= 2) return clean.toUpperCase();
  return (clean[0] + clean[clean.length - 1]).toUpperCase();
}

export default function PublicPlans({ onForked }: { onForked?: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [coverImages, setCoverImages] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [forkingId, setForkingId] = useState<number | null>(null);

  async function load() {
    const response = await fetch("/api/meal-plans/public?limit=20");
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to load public plans.");
      return;
    }
    setPlans(payload.plans ?? []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("bitewise_user_avatar");
        if (saved) setUserAvatar(saved);

        const map: Record<number, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("bitewise_plan_cover_")) {
            const planId = Number(key.replace("bitewise_plan_cover_", ""));
            if (!isNaN(planId)) {
              const val = localStorage.getItem(key);
              if (val) map[planId] = val;
            }
          }
        }
        setCoverImages(map);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function fork(id: number, planName: string) {
    setStatus(null);
    setError(null);
    setForkingId(id);

    const response = await fetch(`/api/meal-plans/${id}/fork`, { method: "POST" });
    const payload = await response.json();
    setForkingId(null);

    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to save this plan.");
      return;
    }

    setStatus(`✓ Forked private copy of "${planName}" to your My Plans!`);
    await load();
    
    // Automatically switch active tab to "My Plans" after 600ms
    setTimeout(() => {
      onForked?.();
    }, 600);
  }

  const filteredPlans = plans.filter((plan) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchName = plan.name.toLowerCase().includes(q);
    const matchCreator = (plan.creator_username || "").toLowerCase().includes(q);
    const matchFood = plan.meal_plan_items?.some((item) =>
      item.food_name.toLowerCase().includes(q)
    );
    return matchName || matchCreator || matchFood;
  });

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xs space-y-4">
      {/* Header Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search public plans by title, creator @username, or food..."
            className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] pl-9 pr-4 text-xs font-semibold placeholder:[var(--ink-muted)] outline-none focus:border-[var(--leaf)] focus:bg-[var(--surface)] transition-all"
          />
          <svg className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <button
          className="active-press shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3.5 h-10 text-xs font-bold text-[var(--ink-muted)] hover:bg-[var(--line)] hover:text-[var(--foreground)] transition-colors"
          onClick={() => void load()}
          type="button"
          title="Refresh public plans"
          aria-label="Refresh public plans"
        >
          <IconRefresh className="size-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {error && <p className="text-xs font-bold text-[var(--coral)]" role="alert">{error}</p>}
      {status && <p className="text-xs font-bold text-[var(--leaf)]" role="status">{status}</p>}

      <div className="space-y-3 pt-1">
        {filteredPlans.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--ink-muted)]">
            {searchQuery.trim() ? `No public plans found matching "${searchQuery}".` : "No public plans available right now."}
          </p>
        ) : (
          filteredPlans.map((plan) => {
            const creatorAvatar = typeof window !== "undefined"
              ? (localStorage.getItem(`bitewise_avatar_${plan.creator_username}`) || (plan.creator_username === "alex_demo" ? userAvatar : null))
              : null;
            const gradientClass = getCreatorGradient(plan.creator_username || "");
            const initials = getCreatorInitials(plan.creator_username || "");

            return (
              <div
                className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-5 shadow-xs transition-shadow hover:shadow-sm"
                key={plan.id}
              >
                {coverImages[plan.id] && (
                  <div className="-mx-5 -mt-5 mb-4 overflow-hidden border-b border-[var(--line)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverImages[plan.id]}
                      alt={plan.name}
                      className="h-32 w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[var(--foreground)]">{plan.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)]">
                      <div className="inline-flex items-center gap-1.5">
                        {creatorAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={creatorAvatar}
                            alt={plan.creator_username}
                            className="size-5 rounded-full object-cover shadow-2xs border border-[var(--line)]"
                          />
                        ) : (
                          <div className={`flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientClass} text-[9px] font-black text-white shadow-2xs`}>
                            {initials}
                          </div>
                        )}
                        <span>By <strong>@{plan.creator_username}</strong></span>
                      </div>
                      <span>·</span>
                      <span className="tabular-nums font-bold text-[var(--leaf)]">
                        {Math.round(Number(plan.total_calories))} kcal
                      </span>
                      <span>·</span>
                      <span>{plan.save_count} saves</span>
                    </div>
                  </div>

                  <button
                    className="active-press shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[var(--leaf)] px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[var(--leaf-deep)] disabled:opacity-50"
                    disabled={forkingId === plan.id}
                    onClick={() => void fork(plan.id, plan.name)}
                    type="button"
                    title="Fork template to My Plans"
                  >
                    <IconFork className="size-3.5" />
                    <span>{forkingId === plan.id ? "Forking..." : "Fork"}</span>
                  </button>
                </div>

                <div className="mt-3 border-t border-[var(--line)]/40 pt-2 text-xs text-[var(--ink-muted)]">
                  {plan.meal_plan_items?.length ?? 0} food items included in template
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
