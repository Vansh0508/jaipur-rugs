import type { SupabaseClient } from "@supabase/supabase-js";

export interface GuestCandidate {
  id: string;
  fullName: string;
  phone: string;
}

/** Backs the New Journey guest picker's "existing guest" match — searched by name or phone. */
export async function searchGuestCandidates(supabase: SupabaseClient, query: string): Promise<GuestCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from("guests")
    .select("id, full_name, phone")
    .or(`full_name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((g) => ({ id: g.id, fullName: g.full_name, phone: g.phone }));
}
