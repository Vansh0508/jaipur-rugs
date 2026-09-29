import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { AuthzError, authzErrorResponse, requireEmployeePermission, type AuthorizedEmployee } from "./authz.ts";

export const sketchCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function sketchJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...sketchCorsHeaders, "Content-Type": "application/json" } });
}

export function sketchClients() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  return {
    supabaseUrl,
    anonKey: Deno.env.get("SUPABASE_ANON_KEY")!,
    admin: createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
  };
}

export async function actorLabel(admin: SupabaseClient, employeeId: string): Promise<string> {
  const { data, error } = await admin.from("employees").select("full_name, employee_code").eq("id", employeeId).single();
  if (error || !data) throw new Error(error?.message || "employee not found");
  return `${data.full_name} (${data.employee_code})`;
}

export async function applySketchAction(
  admin: SupabaseClient,
  actor: AuthorizedEmployee,
  action: string,
  payload: Record<string, unknown>,
) {
  const label = await actorLabel(admin, actor.employeeId);
  const { data, error } = await admin.rpc("sketch_challan_apply_action", {
    p_actor_id: actor.employeeId,
    p_actor_label: label,
    p_action: action,
    p_payload: payload,
  });
  // 42501 = the RPC refused the actor; P0001 = a rule the RPC raised (bad input). Anything else is a real 500.
  if (error) throw error.code === "42501" ? new AuthzError(error.message, 403) : error.code === "P0001" ? new AuthzError(error.message, 400) : new Error(error.message);
  return data;
}

export async function requireSketchPermission(req: Request, permission: string) {
  const { admin, supabaseUrl, anonKey } = sketchClients();
  const actor = await requireEmployeePermission(admin, supabaseUrl, anonKey, req, permission);
  return { admin, actor };
}

export function sketchError(error: unknown): Response {
  return authzErrorResponse(error, sketchCorsHeaders);
}
