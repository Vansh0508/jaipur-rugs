import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@jaipur-rugs/supabase-client";

export type AppEntry = Tables<"apps">;

/** Open-SELECT reference table (see 001_team_members_schema.sql) — every authenticated employee can list these. */
export async function listApps(supabase: SupabaseClient): Promise<AppEntry[]> {
  const { data, error } = await supabase.from("apps").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as AppEntry[];
}
