"use client";

import { useEffect, useRef } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { startLoginSession, heartbeatLoginSession } from "@jaipur-rugs/db-management-client";
import { env } from "@/lib/env";

// Powers the admin User Management screen (db/user-activity/001_login_sessions.sql) —
// this is the ONLY thing that writes to login_sessions from the client side, so it's
// mounted once, high in the (shell) tree (see (shell)/layout.tsx), not per-page.
//
// One session per browser tab: sessionStorage (not localStorage) holds the current
// sessionId, since a session genuinely means "this tab, since it was opened/reused" —
// sharing one id across tabs via localStorage would make closing one tab look like the
// whole visit ended. login-sessions-start itself still reuses a same-employee session
// server-side within a 20-minute window, so reloading THIS tab doesn't fragment into a
// new row either.
//
// Heartbeat only while the tab is actually visible (Page Visibility API) — a background
// tab left open for hours shouldn't count as active time. Pauses the interval on hide,
// resumes (with an immediate heartbeat, not waiting a full interval) on show.
const HEARTBEAT_INTERVAL_MS = 4 * 60_000;
/** Exported so UserMenu's explicit "Sign out" can end the same session before signOut(). */
export const LOGIN_SESSION_STORAGE_KEY = "atlas:loginSessionId";

export function SessionTracker() {
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    function clearHeartbeat() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function sendHeartbeat() {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      heartbeatLoginSession(supabase, sessionId).catch(() => {
        // A 404 here (session ended/expired elsewhere) resolves itself on next
        // visibilitychange/focus, which re-runs ensureSession() below — no retry needed.
      });
    }

    function startHeartbeat() {
      clearHeartbeat();
      if (document.visibilityState !== "visible") return;
      sendHeartbeat();
      intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    }

    async function ensureSession() {
      if (sessionIdRef.current || document.visibilityState !== "visible") return;
      const stored = sessionStorage.getItem(LOGIN_SESSION_STORAGE_KEY);
      if (stored) {
        sessionIdRef.current = stored;
        startHeartbeat();
        return;
      }
      try {
        const { sessionId } = await startLoginSession(supabase);
        if (cancelled) return;
        sessionIdRef.current = sessionId;
        sessionStorage.setItem(LOGIN_SESSION_STORAGE_KEY, sessionId);
        startHeartbeat();
      } catch {
        // Not signed in yet, or the employee record isn't active — nothing to track.
        // The next visibilitychange/focus (e.g. after actually signing in) retries.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        ensureSession();
      } else {
        clearHeartbeat();
      }
    }

    // `keepalive: true` (not sendBeacon) so the real Authorization header can be sent —
    // sendBeacon can't set custom headers, and this edge function needs the caller's own
    // JWT to resolve which session is "theirs" (see login-sessions-end's own comment).
    // Best-effort only: browsers don't guarantee this fires on every close, that's fine —
    // the heartbeat's last_heartbeat_at is the fallback source of truth either way.
    function endSessionBestEffort() {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token;
        if (!token) return;
        fetch(`${env.supabaseUrl}/functions/v1/login-sessions-end`, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: env.supabaseAnonKey,
          },
          body: JSON.stringify({ sessionId }),
        }).catch(() => {});
      });
    }

    ensureSession();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", ensureSession);
    window.addEventListener("pagehide", endSessionBestEffort);

    return () => {
      cancelled = true;
      clearHeartbeat();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", ensureSession);
      window.removeEventListener("pagehide", endSessionBestEffort);
    };
  }, []);

  return null;
}
