// Date/time display for the Internal Portal. Pinned to one time zone (the fleet operates
// in India) rather than "wherever this code runs": journey pages render on the server
// (on-premise host) AND in the browser, and toLocale*String() without a timeZone would
// give different answers in the two places — a wrong trip time, and a hydration mismatch.

export const APP_TIME_ZONE = "Asia/Kolkata";

/** "28/09/2026" — driver-app-new's en-GB 2-digit format. Accepts an ISO timestamp or yyyy-mm-dd. */
export function formatDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: APP_TIME_ZONE });
}

/** "9:05 AM" */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: APP_TIME_ZONE });
}

/** Today as yyyy-mm-dd in APP_TIME_ZONE (not UTC — the UTC date is "yesterday" before 5:30 AM IST). */
export function todayInAppZone() {
  return new Date().toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
}
