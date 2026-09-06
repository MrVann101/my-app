import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

let adminClient: SupabaseClient | undefined;

export function createAdminClient(): SupabaseClient {
  if (!adminClient) {
    const { supabaseUrl, supabaseServiceRoleKey } = getServerEnv();
    adminClient = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return adminClient;
}