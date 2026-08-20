import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@jaipur-rugs/supabase-client";

export type Role = Tables<"roles">;

/** Open-SELECT reference table (see 001_team_members_schema.sql) — every authenticated employee can list these. */
export async function listRoles(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("roles").select("id, name").order("name");
  if (error) throw error;
  return (data ?? []) as Pick<Role, "id" | "name">[];
}
