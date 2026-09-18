import { createClient } from "@/lib/supabase/server";

/**
 * Server-side Supabase client for Server Components and Route Handlers.
 */
export async function getServerSupabaseClient() {
  return await createClient();
}
