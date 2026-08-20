import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@jaipur-rugs/supabase-client";

export type Department = Tables<"departments">;

/** Open-SELECT reference table (see 001_team_members_schema.sql) — every authenticated employee can list these. */
export async function listDepartments(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("departments").select("id, name").order("name");
  if (error) throw error;
  return (data ?? []) as Pick<Department, "id" | "name">[];
}
