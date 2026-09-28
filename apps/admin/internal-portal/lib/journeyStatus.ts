import type { Enums } from "@jaipur-rugs/supabase-client";

export type JourneyStatus = Enums<"journey_status">;

/**
 * The status a journey actually has right now. Nothing ever advances the stored
 * `journeys.status` past `planned` on its own (no cron/trigger does it) — only an explicit
 * cancel (cancel-journey) or Mark ended (complete-journey) writes it. So, like cars'
 * "On trip", the live state is derived from the busy window at read time:
 * a planned journey is `ongoing` while now() is inside [first_pickup_at, last_drop_at] and
 * `completed` once last_drop_at has passed. Cancelled/completed are always taken as stored.
 */
export function effectiveJourneyStatus(
  status: JourneyStatus,
  firstPickupAt: string,
  lastDropAt: string,
  now: number = Date.now(),
): JourneyStatus {
  if (status === "cancelled" || status === "completed") return status;
  if (now > new Date(lastDropAt).getTime()) return "completed";
  if (now >= new Date(firstPickupAt).getTime()) return "ongoing";
  return "planned";
}
