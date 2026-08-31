import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { linkMerchantClerkAccount } from "@jaipur-rugs/db-management-client";
import { getServerMerchantSupabaseClient } from "./supabaseClient.server";

export type MerchantAccessResult =
  | { status: "ok"; merchantId: string }
  | { status: "no_record" }
  | { status: "conflict" };

/**
 * Runs merchants-link-clerk-account on every merchant shell page load — cheap (a single
 * indexed lookup once already linked) and means a re-invite/re-link doesn't need its own
 * separate "please refresh" step. Redirects to /merchant/login if there's no Clerk
 * session at all; returns a status the shell layout renders a message for otherwise,
 * rather than throwing (a brand-new merchant who hasn't been invited yet, or a genuine
 * email conflict, are expected outcomes here, not bugs).
 */
export async function requireMerchantAccess(): Promise<MerchantAccessResult> {
  const { userId, getToken } = await auth();
  if (!userId) {
    redirect("/merchant/login");
  }

  const token = await getToken();
  if (!token) {
    redirect("/merchant/login");
  }

  try {
    const supabase = await getServerMerchantSupabaseClient();
    const { merchantId } = await linkMerchantClerkAccount(supabase, token);
    return { status: "ok", merchantId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("already linked to a different account")) {
      return { status: "conflict" };
    }
    return { status: "no_record" };
  }
}
