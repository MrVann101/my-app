import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FeedbackFocusArea,
  FeedbackItem,
  FeedbackLoggingEase,
  FeedbackStatus,
} from "./feedback-schemas";
import { createAdminClient } from "./supabase/admin";

const GUEST_SENDER_EMAIL = "feedback-vault@users.bitewise.local";
const STRICT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DbFeedbackRow = {
  id: string;
  user_id: string | null;
  username_snapshot: string;
  overall_rating: number;
  focus_area: FeedbackFocusArea;
  logging_ease: FeedbackLoggingEase;
  most_wanted: string | null;
  message: string;
  status: FeedbackStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

let cachedGuestUserId: string | null = null;

function mapRowToItem(row: DbFeedbackRow): FeedbackItem {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    username: row.username_snapshot,
    overallRating: Number(row.overall_rating),
    focusArea: row.focus_area,
    loggingEase: row.logging_ease,
    mostWanted: row.most_wanted ?? null,
    message: row.message,
    status: row.status,
    adminNote: row.admin_note ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveGuestSenderUserId(admin: SupabaseClient): Promise<string> {
  if (cachedGuestUserId) return cachedGuestUserId;

  // Paginate auth users to avoid breaking once total users exceed 200.
  for (let page = 1; page <= 25; page += 1) {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listErr) {
      throw new Error("Unable to resolve guest feedback sender.");
    }
    const users = list?.users ?? [];
    const existing = users.find(
      (u) => u.email?.toLowerCase() === GUEST_SENDER_EMAIL,
    );
    if (existing) {
      cachedGuestUserId = existing.id;
      return existing.id;
    }
    if (users.length < 200) break;
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: GUEST_SENDER_EMAIL,
    password: `${randomUUID()}Aa1!`,
    email_confirm: true,
    user_metadata: { username: "bitewise_guest_feedback" },
  });
  if (createErr || !created?.user) {
    throw new Error("Unable to initialize guest feedback sender.");
  }

  cachedGuestUserId = created.user.id;
  return created.user.id;
}

export async function listSubmittedFeedbackByIds(ids: string[]): Promise<FeedbackItem[]> {
  const cleanIds = ids
    .map((id) => id.trim())
    .filter((id) => STRICT_UUID_RE.test(id))
    .slice(0, 25);

  if (cleanIds.length === 0) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_feedback")
    .select("*")
    .in("id", cleanIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load submitted suggestions.");
  }

  return ((data as DbFeedbackRow[] | null) ?? []).map(mapRowToItem);
}

export async function insertPublicFeedback(input: {
  userId: string | null;
  username: string;
  overallRating: number;
  focusArea: FeedbackFocusArea;
  loggingEase: FeedbackLoggingEase;
  mostWanted: string | null;
  message: string;
}): Promise<FeedbackItem> {
  const admin = createAdminClient();
  const payload = {
    user_id: input.userId,
    username_snapshot: input.username,
    overall_rating: input.overallRating,
    focus_area: input.focusArea,
    logging_ease: input.loggingEase,
    most_wanted: input.mostWanted,
    message: input.message,
  };

  let { data, error } = await admin
    .from("app_feedback")
    .insert(payload)
    .select("*")
    .single();

  // Compatibility fallback if live DB has not yet dropped NOT NULL on app_feedback.user_id (0025).
  if (error && input.userId === null && /null value in column "user_id"|23502/i.test(error.message ?? error.code ?? "")) {
    const guestUserId = await resolveGuestSenderUserId(admin);
    const retry = await admin
      .from("app_feedback")
      .insert({ ...payload, user_id: guestUserId })
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    throw new Error("Unable to save your suggestion.");
  }

  return mapRowToItem(data as DbFeedbackRow);
}

export async function listAllFeedbackForAdmin(admin: SupabaseClient): Promise<FeedbackItem[]> {
  const { data, error } = await admin
    .from("app_feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) {
    throw new Error("Unable to load feedback inbox.");
  }

  return ((data as DbFeedbackRow[] | null) ?? []).map(mapRowToItem);
}

export async function updateFeedbackForAdmin(
  admin: SupabaseClient,
  id: string,
  patch: { status?: FeedbackStatus; adminNote?: string | null },
): Promise<FeedbackItem | null> {
  const now = new Date().toISOString();
  const dbPatch: Record<string, unknown> = {
    updated_at: now,
    reviewed_at: now,
  };
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.adminNote !== undefined) dbPatch.admin_note = patch.adminNote;

  const { data, error } = await admin
    .from("app_feedback")
    .update(dbPatch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error("Unable to update suggestion.");
  }

  return data ? mapRowToItem(data as DbFeedbackRow) : null;
}

export async function deleteFeedbackForAdmin(
  admin: SupabaseClient,
  id: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("app_feedback")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    throw new Error("Unable to delete suggestion.");
  }

  return Array.isArray(data) && data.length > 0;
}
