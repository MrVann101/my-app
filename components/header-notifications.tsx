"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { AppNotificationItem } from "@/app/api/notifications/route";
import { getBrowserTimezone } from "@/lib/date";
import {
  IconBell,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconFlame,
  IconMealPlans,
  IconStar,
  IconX,
} from "./icons";

type StoredNotificationState = {
  readIds: string[];
  dismissedIds: string[];
};

const STORAGE_KEY = "bitewise_notifications_state_v1";

function loadStoredState(): StoredNotificationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { readIds: [], dismissedIds: [] };
    const parsed = JSON.parse(raw) as Partial<StoredNotificationState>;
    return {
      readIds: Array.isArray(parsed.readIds) ? parsed.readIds.filter((v): v is string => typeof v === "string") : [],
      dismissedIds: Array.isArray(parsed.dismissedIds)
        ? parsed.dismissedIds.filter((v): v is string => typeof v === "string")
        : [],
    };
  } catch {
    return { readIds: [], dismissedIds: [] };
  }
}

function saveStoredState(next: StoredNotificationState) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        readIds: next.readIds.slice(-80),
        dismissedIds: next.dismissedIds.slice(-80),
      }),
    );
  } catch {
    // Ignore storage quota errors in private browsing.
  }
}

function categoryIcon(category: AppNotificationItem["category"]) {
  switch (category) {
    case "streak":
      return IconFlame;
    case "plan":
      return IconCalendar;
    case "milestone":
      return IconStar;
    case "community":
      return IconMealPlans;
    default:
      return IconBell;
  }
}

export default function HeaderNotifications() {
  const router = useRouter();
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<AppNotificationItem[]>([]);
  const [reminderSummary, setReminderSummary] = useState<string>("Off");
  const [readIds, setReadIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [anchorPos, setAnchorPos] = useState<{ top: number; right: number }>({ top: 64, right: 16 });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = loadStoredState();
      setReadIds(stored.readIds);
      setDismissedIds(stored.dismissedIds);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const tz = getBrowserTimezone();
      const response = await fetch(`/api/notifications?timezone=${encodeURIComponent(tz)}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        notifications?: AppNotificationItem[];
        reminderSummary?: string;
      };
      if (Array.isArray(payload.notifications)) {
        setItems(payload.notifications);
      }
      if (typeof payload.reminderSummary === "string") {
        setReminderSummary(payload.reminderSummary);
      }
    } catch {
      // Fail silently in navbar badge if offline.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchNotifications();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchNotifications, pathname]);

  const updateAnchor = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchorPos({
      top: Math.round(rect.bottom + 8),
      right: Math.max(12, Math.round(window.innerWidth - rect.right)),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    function onViewportChange() {
      updateAnchor();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange, { passive: true });
    window.addEventListener("scroll", onViewportChange, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange);
    };
  }, [isOpen, updateAnchor]);

  const visibleItems = items.filter((item) => !dismissedIds.includes(item.id));
  const unreadCount = visibleItems.filter((item) => !readIds.includes(item.id)).length;
  const remindersActive = reminderSummary !== "Off";

  function markRead(id: string) {
    if (readIds.includes(id)) return;
    const nextRead = [...readIds, id];
    setReadIds(nextRead);
    saveStoredState({ readIds: nextRead, dismissedIds });
  }

  function markAllRead() {
    const merged = Array.from(new Set([...readIds, ...visibleItems.map((item) => item.id)]));
    setReadIds(merged);
    saveStoredState({ readIds: merged, dismissedIds });
  }

  function dismissNotification(id: string) {
    const nextDismissed = Array.from(new Set([...dismissedIds, id]));
    const nextRead = Array.from(new Set([...readIds, id]));
    setDismissedIds(nextDismissed);
    setReadIds(nextRead);
    saveStoredState({ readIds: nextRead, dismissedIds: nextDismissed });
  }

  function toggleOpen() {
    if (!isOpen) {
      updateAnchor();
      void fetchNotifications();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`active-press relative grid size-10 shrink-0 place-items-center rounded-full border bg-[var(--surface)] shadow-xs transition-colors after:absolute after:-inset-0.5 after:content-[''] hover:border-[var(--leaf)] hover:bg-[var(--surface-muted)] sm:size-11 sm:after:hidden ${
          isOpen
            ? "border-[var(--leaf)] text-[var(--leaf)]"
            : "border-[var(--border-control)] text-[var(--ink-muted)] hover:text-[var(--foreground)]"
        }`}
      >
        <IconBell className="size-4.5 sm:size-5" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="tabular-nums absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[var(--leaf)] px-1 text-[10px] font-extrabold text-[var(--on-leaf)] ring-2 ring-[var(--surface)] sm:h-5 sm:min-w-5"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsOpen(false);
              }
            }}
          >
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Notifications"
              style={
                typeof window !== "undefined" && window.innerWidth >= 640
                  ? { top: `${anchorPos.top}px`, right: `${anchorPos.right}px` }
                  : { top: `${anchorPos.top}px` }
              }
              className="popover-enter fixed inset-x-3 z-50 flex max-h-[78dvh] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:inset-x-auto sm:w-[25rem]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-[var(--foreground)]">Notifications</h2>
                  {unreadCount > 0 && (
                    <span className="tabular-nums rounded-full bg-[var(--leaf-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--leaf-ink)]">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="active-press inline-flex min-h-9 items-center gap-1 rounded-xl px-2.5 text-xs font-bold text-[var(--leaf-ink)] hover:bg-[var(--leaf-light)]/60"
                    >
                      <IconCheck className="size-3.5" />
                      <span>Mark read</span>
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Close notifications"
                    onClick={() => setIsOpen(false)}
                    className="active-press grid size-9 place-items-center rounded-xl text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                  >
                    <IconX className="size-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto p-2.5">
                {visibleItems.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <div className="mx-auto grid size-10 place-items-center rounded-full bg-[var(--surface-muted)] text-[var(--ink-muted)]">
                      <IconBell className="size-5" />
                    </div>
                    <p className="mt-2.5 text-xs font-bold text-[var(--foreground)]">You&apos;re all caught up</p>
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">
                      Daily reminders, streak updates, and meal plan alerts will appear here.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {visibleItems.map((item) => {
                      const isUnread = !readIds.includes(item.id);
                      const Icon = categoryIcon(item.category);
                      return (
                        <li
                          key={item.id}
                          className={`flex items-start gap-2 rounded-xl border p-3 transition-colors ${
                            isUnread
                              ? "border-[var(--leaf)]/30 bg-[var(--leaf-light)]/35 hover:bg-[var(--leaf-light)]/60"
                              : "border-[var(--line)]/60 bg-[var(--surface-muted)]/50 hover:border-[var(--line)] hover:bg-[var(--surface-muted)]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              markRead(item.id);
                              setIsOpen(false);
                              router.push(item.href);
                            }}
                            className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          >
                            <div
                              className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border ${
                                isUnread
                                  ? "border-[var(--leaf)]/30 bg-[var(--surface)] text-[var(--leaf)]"
                                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-muted)]"
                              }`}
                            >
                              <Icon className="size-4.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {isUnread && (
                                  <span
                                    aria-hidden="true"
                                    className="size-1.5 shrink-0 rounded-full bg-[var(--leaf)]"
                                  />
                                )}
                                <p className="truncate text-xs font-bold text-[var(--foreground)]">{item.title}</p>
                                <span className="ml-auto shrink-0 rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ink-muted)]">
                                  {item.tag}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                                {item.body}
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            aria-label={`Dismiss ${item.title}`}
                            onClick={() => dismissNotification(item.id)}
                            className="grid size-7 shrink-0 place-items-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                          >
                            <IconX className="size-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="border-t border-[var(--line)] p-2.5">
                <Link
                  href="/profile/notifications"
                  onClick={() => setIsOpen(false)}
                  className="active-press flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]/75 px-3.5 py-2.5 transition-colors hover:border-[var(--leaf)] hover:bg-[var(--surface-muted)]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface)] text-[var(--leaf)]">
                      <IconBell className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[var(--foreground)]">Meal Reminders</p>
                      <p className="truncate text-[11px] text-[var(--ink-muted)]">
                        {remindersActive ? reminderSummary : "Currently turned off"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        remindersActive
                          ? "bg-[var(--leaf-light)] text-[var(--leaf-ink)]"
                          : "bg-[var(--surface)] text-[var(--ink-muted)]"
                      }`}
                    >
                      {remindersActive ? "Active" : "Off"}
                    </span>
                    <IconChevronRight className="size-4 text-[var(--leaf)]" />
                  </div>
                </Link>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
