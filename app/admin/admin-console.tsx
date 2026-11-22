"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconCheck,
  IconChevronLeft,
  IconSearch,
  IconStar,
  IconTrash,
} from "@/components/icons";
import {
  FEEDBACK_STATUSES,
  FOCUS_AREA_OPTIONS,
  LOGGING_EASE_OPTIONS,
  STATUS_META,
  type FeedbackFocusArea,
  type FeedbackItem,
  type FeedbackLoggingEase,
  type FeedbackStatus,
} from "@/lib/feedback-schemas";
import { isSafeMealPlanImageUrl } from "@/lib/image-security";

type PublicPlanSummary = {
  id: string;
  name: string;
  creator: string;
  goal: string | null;
  totalCalories: number;
  saveCount: number;
  photoUrl: string | null;
  createdAt: string;
};

type AdminOverviewPayload = {
  adminUsername: string;
  summary: {
    totalUsers: number;
    totalFeedback: number;
    openFeedback: number;
    averageRating: number | null;
    topFocusArea: FeedbackFocusArea | null;
    areaCounts: Record<FeedbackFocusArea, number>;
    loggingEaseCounts: Record<FeedbackLoggingEase, number>;
  };
  feedback: FeedbackItem[];
  publicPlans: PublicPlanSummary[];
};

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16);
  }
}

export default function AdminConsole() {
  const [data, setData] = useState<AdminOverviewPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"inbox" | "plans">("inbox");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [areaFilter, setAreaFilter] = useState<FeedbackFocusArea | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const applyOverviewPayload = useCallback((typed: AdminOverviewPayload) => {
    setData(typed);
    const initialNotes: Record<string, string> = {};
    for (const item of typed.feedback) {
      initialNotes[item.id] = item.adminNote ?? "";
    }
    setDraftNotes(initialNotes);
  }, []);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/overview");
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Unable to load Admin Console.");
        return;
      }
      applyOverviewPayload(payload as AdminOverviewPayload);
    } catch {
      setError("Unable to reach Bitewise server. Check your connection.");
    } finally {
      setIsLoading(false);
    }
  }, [applyOverviewPayload]);

  useEffect(() => {
    let active = true;
    async function initialFetch() {
      try {
        const response = await fetch("/api/admin/overview");
        const payload = await response.json();
        if (!active) return;
        if (!response.ok) {
          setError(payload.error?.message ?? "Unable to load Admin Console.");
          return;
        }
        applyOverviewPayload(payload as AdminOverviewPayload);
      } catch {
        if (active) {
          setError("Unable to reach Bitewise server. Check your connection.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void initialFetch();
    return () => {
      active = false;
    };
  }, [applyOverviewPayload]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2800);
  }

  async function updateFeedbackStatus(id: string, status: FeedbackStatus) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error?.message ?? "Unable to update status.");
        return;
      }
      setData((prev) => {
        if (!prev) return prev;
        const nextFeedback = prev.feedback.map((item) =>
          item.id === id ? (payload.item as FeedbackItem) : item,
        );
        const openFeedback = nextFeedback.filter(
          (f) => f.status === "new" || f.status === "reviewing",
        ).length;
        return {
          ...prev,
          feedback: nextFeedback,
          summary: { ...prev.summary, openFeedback },
        };
      });
      showToast(`Marked suggestion as ${STATUS_META[status].label}.`);
    } catch {
      setError("Network error updating suggestion status.");
    } finally {
      setBusyId(null);
    }
  }

  async function saveAdminNote(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const adminNote = (draftNotes[id] ?? "").trim();
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: adminNote.length > 0 ? adminNote : null }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error?.message ?? "Unable to save note.");
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              feedback: prev.feedback.map((item) =>
                item.id === id ? (payload.item as FeedbackItem) : item,
              ),
            }
          : prev,
      );
      showToast("Saved note for user.");
    } catch {
      setError("Network error saving note.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteFeedback(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json();
        setError(payload.error?.message ?? "Unable to delete suggestion.");
        return;
      }
      setData((prev) => {
        if (!prev) return prev;
        const nextFeedback = prev.feedback.filter((f) => f.id !== id);
        return {
          ...prev,
          feedback: nextFeedback,
          summary: {
            ...prev.summary,
            totalFeedback: nextFeedback.length,
            openFeedback: nextFeedback.filter(
              (f) => f.status === "new" || f.status === "reviewing",
            ).length,
          },
        };
      });
      showToast("Suggestion deleted.");
    } catch {
      setError("Network error deleting suggestion.");
    } finally {
      setBusyId(null);
    }
  }

  async function unpublishPlan(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/public-plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: "private" }),
      });
      if (!res.ok) {
        const payload = await res.json();
        setError(payload.error?.message ?? "Unable to unpublish plan.");
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              publicPlans: prev.publicPlans.filter((p) => p.id !== id),
            }
          : prev,
      );
      showToast("Plan moved to Private and removed from Community feed.");
    } catch {
      setError("Network error moderating public plan.");
    } finally {
      setBusyId(null);
    }
  }

  async function deletePublicPlan(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/public-plans/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json();
        setError(payload.error?.message ?? "Unable to delete plan.");
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              publicPlans: prev.publicPlans.filter((p) => p.id !== id),
            }
          : prev,
      );
      showToast("Public meal plan permanently deleted.");
    } catch {
      setError("Network error deleting meal plan.");
    } finally {
      setBusyId(null);
    }
  }

  const filteredFeedback = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.feedback.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (areaFilter !== "all" && item.focusArea !== areaFilter) return false;
      if (q) {
        const hay = `${item.username} ${item.message} ${item.mostWanted ?? ""} ${item.adminNote ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, statusFilter, areaFilter, searchQuery]);

  const filteredPlans = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data.publicPlans;
    return data.publicPlans.filter((plan) =>
      `${plan.name} ${plan.creator}`.toLowerCase().includes(q),
    );
  }, [data, searchQuery]);

  const topAreaLabel = data?.summary.topFocusArea
    ? FOCUS_AREA_OPTIONS.find((a) => a.value === data.summary.topFocusArea)?.label ??
      data.summary.topFocusArea
    : "No data yet";

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/profile"
          className="active-press inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] shadow-2xs transition-colors hover:border-[var(--leaf)] hover:text-[var(--leaf)]"
        >
          <IconChevronLeft className="size-4" />
          <span>Back to Settings</span>
        </Link>

        <button
          type="button"
          onClick={() => void loadOverview()}
          disabled={isLoading}
          className="active-press inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--foreground)] shadow-2xs transition-colors hover:border-[var(--leaf)] disabled:opacity-50"
        >
          {isLoading ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {toast && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-[var(--leaf)]/35 bg-[var(--leaf-light)] px-4 py-3 text-xs font-bold text-[var(--leaf-ink)]"
        >
          <IconCheck className="size-4 shrink-0 text-[var(--leaf)]" />
          <span>{toast}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--coral)]/35 bg-[var(--coral-soft)] px-4 py-3 text-xs font-bold text-[var(--coral)]"
        >
          {error}
        </div>
      )}

      {isLoading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
          <div className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
          <div className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
          <div className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
          <div className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
        </div>
      ) : data ? (
        <>
          {/* Summary KPI Strip */}
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                Open Ideas
              </p>
              <p className="tabular-nums mt-2 text-3xl font-extrabold text-[var(--foreground)]">
                {data.summary.openFeedback}
              </p>
              <p className="tabular-nums mt-1 text-xs text-[var(--ink-muted)]">
                Out of {data.summary.totalFeedback} total submissions
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                Avg Experience Score
              </p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="tabular-nums text-3xl font-extrabold text-[var(--leaf-ink)]">
                  {data.summary.averageRating !== null
                    ? data.summary.averageRating.toFixed(1)
                    : "0.0"}
                </span>
                <span className="text-sm font-bold text-[var(--ink-muted)]">/ 5.0</span>
              </div>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Member pulse rating
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                Top Requested Area
              </p>
              <p className="mt-2 truncate text-lg font-extrabold text-[var(--foreground)]">
                {topAreaLabel}
              </p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Most selected focus category
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                Active Profiles
              </p>
              <p className="tabular-nums mt-2 text-3xl font-extrabold text-[var(--foreground)]">
                {data.summary.totalUsers.toLocaleString()}
              </p>
              <p className="tabular-nums mt-1 text-xs text-[var(--ink-muted)]">
                {data.publicPlans.length} public meal plans live
              </p>
            </div>
          </div>

          {/* Feature Demand & Logging Friction Breakdown */}
          {data.summary.totalFeedback > 0 && (
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xs lg:col-span-2">
                <h2 className="text-sm font-bold text-[var(--foreground)]">
                  Requests by Feature Area
                </h2>
                <div className="mt-4 space-y-2.5">
                  {FOCUS_AREA_OPTIONS.map((opt) => {
                    const count = data.summary.areaCounts[opt.value] ?? 0;
                    const pct =
                      data.summary.totalFeedback > 0
                        ? Math.round((count / data.summary.totalFeedback) * 100)
                        : 0;
                    return (
                      <div key={opt.value} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--foreground)]">
                            {opt.label}
                          </span>
                          <span className="tabular-nums font-bold text-[var(--ink-muted)]">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                          <div
                            className="h-full rounded-full bg-[var(--leaf)] transition-all duration-300"
                            style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xs">
                <h2 className="text-sm font-bold text-[var(--foreground)]">
                  Meal Logging Ease
                </h2>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  How effortless daily food logging feels to members.
                </p>
                <div className="mt-4 space-y-3">
                  {LOGGING_EASE_OPTIONS.map((opt) => {
                    const count = data.summary.loggingEaseCounts[opt.value] ?? 0;
                    const pct =
                      data.summary.totalFeedback > 0
                        ? Math.round((count / data.summary.totalFeedback) * 100)
                        : 0;
                    return (
                      <div
                        key={opt.value}
                        className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--background)] px-3.5 py-2.5"
                      >
                        <div>
                          <span className="block text-xs font-bold text-[var(--foreground)]">
                            {opt.label}
                          </span>
                          <span className="block text-[11px] text-[var(--ink-muted)]">
                            {opt.description}
                          </span>
                        </div>
                        <span className="tabular-nums text-sm font-extrabold text-[var(--leaf-ink)]">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* Console Tabs & Search */}
          <div className="flex flex-col justify-between gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2" role="tablist" aria-label="Admin sections">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "inbox"}
                onClick={() => setActiveTab("inbox")}
                className={`active-press inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-xs font-bold transition-colors ${
                  activeTab === "inbox"
                    ? "bg-[var(--leaf)] text-[var(--on-leaf)]"
                    : "bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <span>Suggestion Inbox</span>
                <span className="tabular-nums rounded-full bg-black/15 px-2 py-0.5 text-[11px]">
                  {data.feedback.length}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "plans"}
                onClick={() => setActiveTab("plans")}
                className={`active-press inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-xs font-bold transition-colors ${
                  activeTab === "plans"
                    ? "bg-[var(--leaf)] text-[var(--on-leaf)]"
                    : "bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <span>Public Meal Plans</span>
                <span className="tabular-nums rounded-full bg-black/15 px-2 py-0.5 text-[11px]">
                  {data.publicPlans.length}
                </span>
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <IconSearch className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--ink-muted)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={
                  activeTab === "inbox"
                    ? "Search @user or idea..."
                    : "Search plan or @creator..."
                }
                aria-label="Filter items"
                className="h-10 w-full rounded-xl border border-[var(--border-control)] bg-[var(--surface)] pr-3.5 pl-9 text-xs outline-none transition-colors focus:border-[var(--leaf)]"
              />
            </div>
          </div>

          {activeTab === "inbox" ? (
            <div className="space-y-4">
              {/* Status & Area Filter Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-bold transition-colors ${
                      statusFilter === "all"
                        ? "border-[var(--leaf)] bg-[var(--leaf-light)] text-[var(--leaf-ink)]"
                        : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    All
                  </button>
                  {FEEDBACK_STATUSES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-bold transition-colors ${
                        statusFilter === st
                          ? "border-[var(--leaf)] bg-[var(--leaf-light)] text-[var(--leaf-ink)]"
                          : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {STATUS_META[st].label}
                    </button>
                  ))}
                </div>

                <select
                  value={areaFilter}
                  onChange={(event) =>
                    setAreaFilter(event.target.value as FeedbackFocusArea | "all")
                  }
                  aria-label="Filter by feature area"
                  className="h-9 rounded-xl border border-[var(--border-control)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--leaf)]"
                >
                  <option value="all">All feature areas</option>
                  {FOCUS_AREA_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {filteredFeedback.length === 0 ? (
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    No matching suggestions
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    When members submit ideas on /feedback, they will appear right here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredFeedback.map((item) => {
                    const areaLabel =
                      FOCUS_AREA_OPTIONS.find((a) => a.value === item.focusArea)?.label ??
                      item.focusArea;
                    const easeLabel =
                      LOGGING_EASE_OPTIONS.find((e) => e.value === item.loggingEase)?.label ??
                      item.loggingEase;
                    const isItemBusy = busyId === item.id;

                    return (
                      <article
                        key={item.id}
                        className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xs sm:p-6"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-[var(--foreground)]">
                              @{item.username}
                            </span>
                            <span className="tabular-nums inline-flex items-center gap-1 rounded-full bg-[var(--leaf-light)] px-2.5 py-0.5 text-xs font-bold text-[var(--leaf-ink)]">
                              <IconStar className="size-3.5 fill-[var(--leaf)] text-[var(--leaf)]" />
                              {item.overallRating}/5
                            </span>
                            <span className="rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--foreground)]">
                              {areaLabel}
                            </span>
                            <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[11px] text-[var(--ink-muted)]">
                              Logging: {easeLabel}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <time className="tabular-nums text-xs text-[var(--ink-muted)]">
                              {formatDateTime(item.createdAt)}
                            </time>
                            <button
                              type="button"
                              disabled={isItemBusy}
                              onClick={() => void deleteFeedback(item.id)}
                              aria-label="Delete suggestion"
                              className="grid size-9 cursor-pointer place-items-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--coral-soft)] hover:text-[var(--coral)] disabled:opacity-50"
                            >
                              <IconTrash className="size-4" />
                            </button>
                          </div>
                        </div>

                        {item.mostWanted && (
                          <p className="mt-2.5 text-xs font-bold text-[var(--leaf-ink)]">
                            Top wish: {item.mostWanted}
                          </p>
                        )}

                        <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
                          {item.message}
                        </p>

                        {/* Status Workflow Pills */}
                        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] pt-4">
                          <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                            Status:
                          </span>
                          {FEEDBACK_STATUSES.map((st) => {
                            const active = item.status === st;
                            return (
                              <button
                                key={st}
                                type="button"
                                disabled={isItemBusy}
                                onClick={() => void updateFeedbackStatus(item.id, st)}
                                className={`min-h-8 cursor-pointer rounded-lg border px-2.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                                  active
                                    ? "border-[var(--leaf)] bg-[var(--leaf)] text-[var(--on-leaf)]"
                                    : "border-[var(--border-control)] bg-[var(--background)] text-[var(--ink-muted)] hover:border-[var(--leaf)]/60 hover:text-[var(--foreground)]"
                                }`}
                              >
                                {STATUS_META[st].label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Admin Note / Reply to Member */}
                        <div className="mt-3.5 flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            value={draftNotes[item.id] ?? ""}
                            onChange={(event) =>
                              setDraftNotes((prev) => ({
                                ...prev,
                                [item.id]: event.target.value,
                              }))
                            }
                            maxLength={1000}
                            placeholder="Write an optional reply or note (visible to this member on /feedback)..."
                            aria-label={`Reply note for ${item.username}`}
                            className="h-10 flex-1 rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3.5 text-xs outline-none transition-colors focus:border-[var(--leaf)]"
                          />
                          <button
                            type="button"
                            disabled={isItemBusy}
                            onClick={() => void saveAdminNote(item.id)}
                            className="active-press inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[var(--leaf)]/40 bg-[var(--leaf-light)] px-4 text-xs font-bold text-[var(--leaf-ink)] hover:bg-[var(--leaf)] hover:text-[var(--on-leaf)] disabled:opacity-50"
                          >
                            Save Note
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Public Meal Plan Moderation Tab */
            <div className="space-y-3.5">
              {filteredPlans.length === 0 ? (
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    No public meal plans found
                  </p>
                </div>
              ) : (
                filteredPlans.map((plan) => {
                  const isItemBusy = busyId === plan.id;
                  return (
                    <div
                      key={plan.id}
                      className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xs sm:flex-row sm:items-center sm:p-5"
                    >
                      <div className="flex items-center gap-3.5">
                        {plan.photoUrl && isSafeMealPlanImageUrl(plan.photoUrl) ? (
                          <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={plan.photoUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="grid size-14 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] text-xs font-bold text-[var(--ink-muted)]">
                            No img
                          </div>
                        )}

                        <div>
                          <h3 className="text-sm font-bold text-[var(--foreground)]">
                            {plan.name}
                          </h3>
                          <p className="tabular-nums mt-0.5 text-xs text-[var(--ink-muted)]">
                            by <strong className="text-[var(--foreground)]">@{plan.creator}</strong>
                            {" · "}
                            {Math.round(plan.totalCalories).toLocaleString()} kcal
                            {" · "}
                            {plan.saveCount} {plan.saveCount === 1 ? "save" : "saves"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isItemBusy}
                          onClick={() => void unpublishPlan(plan.id)}
                          className="active-press inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-[var(--border-control)] bg-[var(--background)] px-3.5 text-xs font-bold text-[var(--foreground)] hover:border-[var(--leaf)] disabled:opacity-50"
                        >
                          Move to Private
                        </button>
                        <button
                          type="button"
                          disabled={isItemBusy}
                          onClick={() => void deletePublicPlan(plan.id)}
                          className="active-press inline-flex min-h-10 cursor-pointer items-center gap-1 rounded-xl border border-[var(--coral)]/40 bg-[var(--coral-soft)] px-3.5 text-xs font-bold text-[var(--coral)] hover:opacity-85 disabled:opacity-50"
                        >
                          <IconTrash className="size-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
