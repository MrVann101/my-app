import { z } from "zod";

export const FEEDBACK_FOCUS_AREAS = [
  "meal_logging",
  "ai_photo_scan",
  "weekly_planner",
  "meal_plans",
  "targets_progress",
  "ui_speed",
  "other",
] as const;

export type FeedbackFocusArea = (typeof FEEDBACK_FOCUS_AREAS)[number];

export const FEEDBACK_LOGGING_EASE = [
  "very_easy",
  "okay",
  "needs_work",
] as const;

export type FeedbackLoggingEase = (typeof FEEDBACK_LOGGING_EASE)[number];

export const FEEDBACK_STATUSES = [
  "new",
  "reviewing",
  "planned",
  "shipped",
  "archived",
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FOCUS_AREA_OPTIONS: ReadonlyArray<{
  value: FeedbackFocusArea;
  label: string;
  hint: string;
  placeholder: string;
}> = [
  {
    value: "meal_logging",
    label: "Quick Log & Search",
    hint: "Searching foods, portions, or daily log entries",
    placeholder:
      "e.g. Searching for local dishes could include common serving sizes like 1 cup cooked rice...",
  },
  {
    value: "ai_photo_scan",
    label: "AI Photo Scan",
    hint: "Camera scan accuracy, speed, or portion edits",
    placeholder:
      "e.g. When scanning mixed bowls, let me adjust individual ingredient weights before saving...",
  },
  {
    value: "weekly_planner",
    label: "Weekly Plan & Grocery",
    hint: "7-day schedule generation or grocery checklist",
    placeholder:
      "e.g. Let me lock my favorite breakfast across all 7 days when regenerating a weekly plan...",
  },
  {
    value: "meal_plans",
    label: "Meal Plans & Recipes",
    hint: "Saved recipes, Cook with Ingredients, or Public Plans",
    placeholder:
      "e.g. Add high-protein budget filter tags when browsing Public Plans...",
  },
  {
    value: "targets_progress",
    label: "Targets & Progress",
    hint: "Calorie targets, weight check-ins, or trend charts",
    placeholder:
      "e.g. Show a 7-day protein average line alongside daily calories on Progress...",
  },
  {
    value: "ui_speed",
    label: "Design & Speed",
    hint: "Mobile layout, navigation, dark mode, or load time",
    placeholder:
      "e.g. Add a quick shortcut to duplicate yesterday's breakfast in one tap...",
  },
  {
    value: "other",
    label: "Something Else",
    hint: "New feature idea, bug report, or general thought",
    placeholder:
      "Share what would make Bitewise noticeably more helpful in your daily routine...",
  },
];

export const RATING_OPTIONS: ReadonlyArray<{
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
}> = [
  { value: 1, label: "Needs work" },
  { value: 2, label: "Rough spots" },
  { value: 3, label: "Good start" },
  { value: 4, label: "Really good" },
  { value: 5, label: "Loving it" },
];

export const LOGGING_EASE_OPTIONS: ReadonlyArray<{
  value: FeedbackLoggingEase;
  label: string;
  description: string;
}> = [
  {
    value: "very_easy",
    label: "Very easy",
    description: "Takes seconds to log meals",
  },
  {
    value: "okay",
    label: "Mostly okay",
    description: "Works well with minor friction",
  },
  {
    value: "needs_work",
    label: "Takes too many taps",
    description: "Hard to find or adjust items",
  },
];

export const MOST_WANTED_CHIPS: readonly string[] = [
  "More Filipino & local dishes",
  "Faster food search",
  "Richer progress charts",
  "More recipe filters",
  "Custom meal slots",
  "Bug fix or UI polish",
];

export const STATUS_META: Record<
  FeedbackStatus,
  { label: string; tone: "neutral" | "sky" | "leaf" | "muted" }
> = {
  new: { label: "New", tone: "sky" },
  reviewing: { label: "Reviewing", tone: "neutral" },
  planned: { label: "Planned", tone: "leaf" },
  shipped: { label: "Shipped", tone: "leaf" },
  archived: { label: "Archived", tone: "muted" },
};

export const createFeedbackSchema = z.object({
  senderName: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  overallRating: z.number().int().min(1).max(5),
  focusArea: z.enum(FEEDBACK_FOCUS_AREAS),
  loggingEase: z.enum(FEEDBACK_LOGGING_EASE),
  mostWanted: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  message: z.string().trim().min(5).max(1500),
});

export const updateFeedbackAdminSchema = z
  .object({
    status: z.enum(FEEDBACK_STATUSES).optional(),
    adminNote: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? undefined : v && v.length > 0 ? v : null)),
  })
  .refine((data) => data.status !== undefined || data.adminNote !== undefined, {
    message: "Provide at least status or adminNote to update.",
  });

export type FeedbackItem = {
  id: string;
  userId: string | null;
  username: string;
  overallRating: number;
  focusArea: FeedbackFocusArea;
  loggingEase: FeedbackLoggingEase;
  mostWanted: string | null;
  message: string;
  status: FeedbackStatus;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
