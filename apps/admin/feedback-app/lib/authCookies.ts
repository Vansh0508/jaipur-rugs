// Neither guests nor employees are Supabase Auth users in this app (see
// supabase/functions/{guest-signup,employee-signin}) — there's no session to persist, so
// "remembering" who's using this browser is just a plain (non-httpOnly) cookie holding
// the id each sign-in call returns. This is a label, not a verified identity; see
// submit-feedback's own comment on that tradeoff.

export const GUEST_ID_COOKIE = "jr_guest_id";
export const EMPLOYEE_ID_COOKIE = "jr_employee_id";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** A year is generous for a "have we seen this browser before" cookie. */
function setCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function getGuestIdCookie(): string | null {
  return getCookie(GUEST_ID_COOKIE);
}

/** Also clears any stale employee cookie — a browser only ever carries one identity. */
export function setGuestIdCookie(guestId: string): void {
  clearCookie(EMPLOYEE_ID_COOKIE);
  setCookie(GUEST_ID_COOKIE, guestId);
}

export function getEmployeeIdCookie(): string | null {
  return getCookie(EMPLOYEE_ID_COOKIE);
}

/** Also clears any stale guest cookie — a browser only ever carries one identity. */
export function setEmployeeIdCookie(employeeId: string): void {
  clearCookie(GUEST_ID_COOKIE);
  setCookie(EMPLOYEE_ID_COOKIE, employeeId);
}
