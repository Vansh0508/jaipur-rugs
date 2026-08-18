// Read-only Supabase client, shared by every app (AGENTS.md Section 4 / 9).
// This client is anon-key only and never gains a service-role key — writes go through
// the db-management API instead. Do not add a write-capable/service-role client here.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createSupabaseReadOnlyClient(url: string, anonKey: string): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey);
}

export type { Database };
export type { Tables, TablesInsert, TablesUpdate, Enums } from "./types";
