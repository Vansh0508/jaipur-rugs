// Status emails for conference and journey bookings — see db/booking-requests/005. Six
// events: a request was sent (confirmation pending), confirmed, or rejected, for each kind.
//
// Sent from the Edge Functions after the write they describe, never from the apps: only here
// can an employee's email be read (the employee portal has no session, and must never see
// addresses). Best-effort by design — sendBookingEmail never throws, so a mail problem can't
// undo or block a booking; every attempt lands in booking_email_log (sent / failed / skipped).
//
// SMTP: implicit TLS on port 465. Supabase Edge Functions can't open ports 25 or 587
// (https://supabase.com/docs/guides/functions/limits), so the mail server must accept SMTPS on
// 465. Settings come from Vault ('booking_smtp_config', via get_booking_smtp_config()), falling
// back to SMTP_* function secrets — loaded from the gitignored supabase/functions/.env.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { formatIstRange } from "./conference.ts";
import { sendSmtp } from "./smtp.ts";

export type BookingEmailEvent =
  | "conference_request_sent"
  | "conference_confirmed"
  | "conference_rejected"
  | "journey_request_sent"
  | "journey_confirmed"
  | "journey_rejected";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  fromName?: string;
  /** Employee portal base URL, for the "open the portal" link. Optional. */
  portalUrl?: string;
}

export interface EmailRefs {
  conferenceBookingRequestId?: string | null;
  journeyRequestId?: string | null;
  conferenceBookingId?: string | null;
  journeyId?: string | null;
}

export interface EmailContent {
  subject: string;
  /** Paragraphs, already plain text; escaped for HTML here. */
  intro: string;
  /** Label → value rows for the details table. */
  details: [string, string][];
  /** Optional closing line (e.g. the reason for a rejection). */
  outro?: string;
  /** Path under the employee portal to link to, e.g. "/conference-booking". */
  portalPath?: string;
}

// ── config ───────────────────────────────────────────────────────────────────────────────

// Cached per worker for a few minutes (so a changed password takes effect soon); a missing
// config is never cached, so emails start the moment the settings are loaded.
const CONFIG_TTL_MS = 5 * 60_000;
let cached: { config: SmtpConfig; at: number } | null = null;

async function loadConfig(supabaseAdmin: SupabaseClient): Promise<SmtpConfig | null> {
  if (cached && Date.now() - cached.at < CONFIG_TTL_MS) return cached.config;
  let raw: Record<string, unknown> | null = null;
  const { data, error } = await supabaseAdmin.rpc("get_booking_smtp_config");
  if (!error && data && typeof data === "object") raw = data as Record<string, unknown>;
  if (!raw && Deno.env.get("SMTP_HOST")) {
    raw = {
      host: Deno.env.get("SMTP_HOST"),
      port: Deno.env.get("SMTP_PORT"),
      user: Deno.env.get("SMTP_USER"),
      pass: Deno.env.get("SMTP_PASS"),
      from: Deno.env.get("SMTP_FROM"),
      fromName: Deno.env.get("SMTP_FROM_NAME"),
      portalUrl: Deno.env.get("EMPLOYEE_PORTAL_URL"),
    };
  }
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const host = str(raw?.host);
  const user = str(raw?.user);
  const pass = typeof raw?.pass === "string" && raw.pass ? raw.pass : undefined;
  const from = str(raw?.from) ?? user;
  const port = Number(raw?.port ?? 465) || 465;
  if (!host || !user || !pass || !from) return null;
  const config = { host, port, user, pass, from, fromName: str(raw?.fromName), portalUrl: str(raw?.portalUrl)?.replace(/\/+$/, "") };
  cached = { config, at: Date.now() };
  return config;
}

// ── rendering ────────────────────────────────────────────────────────────────────────────

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function render(name: string, content: EmailContent, portalUrl?: string) {
  const link = portalUrl && content.portalPath ? `${portalUrl}${content.portalPath}` : null;
  const text = [
    `Hi ${name},`,
    "",
    content.intro,
    "",
    ...content.details.map(([label, value]) => `${label}: ${value}`),
    ...(content.outro ? ["", content.outro] : []),
    ...(link ? ["", `Employee portal: ${link}`] : []),
    "",
    "— Jaipur Rugs admin team",
    "(This is an automatic message.)",
  ].join("\n");

  const rows = content.details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;color:#111827">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827;max-width:560px">` +
    `<p>Hi ${escapeHtml(name)},</p>` +
    `<p>${escapeHtml(content.intro)}</p>` +
    `<table style="border-collapse:collapse;margin:12px 0">${rows}</table>` +
    (content.outro ? `<p>${escapeHtml(content.outro)}</p>` : "") +
    (link ? `<p><a href="${escapeHtml(link)}" style="color:#2563eb">Open the employee portal</a></p>` : "") +
    `<p style="color:#6b7280">— Jaipur Rugs admin team<br><span style="font-size:12px">This is an automatic message.</span></p>` +
    `</div>`;
  return { text, html };
}

// ── sending ──────────────────────────────────────────────────────────────────────────────

async function log(
  supabaseAdmin: SupabaseClient,
  row: { event: BookingEmailEvent; employee_id: string; recipient: string | null; subject: string; status: "sent" | "failed" | "skipped"; error?: string | null },
  refs: EmailRefs,
) {
  const { error } = await supabaseAdmin.from("booking_email_log").insert({
    ...row,
    error: row.error ? row.error.slice(0, 2000) : null,
    conference_booking_request_id: refs.conferenceBookingRequestId ?? null,
    journey_request_id: refs.journeyRequestId ?? null,
    conference_booking_id: refs.conferenceBookingId ?? null,
    journey_id: refs.journeyId ?? null,
  });
  if (error) console.error("booking_email_log insert failed:", error.message);
}

/**
 * Emails one employee about a booking. Never throws: a missing config, an employee without an
 * address, or an SMTP failure is logged (booking_email_log) and swallowed.
 */
export async function sendBookingEmail(
  supabaseAdmin: SupabaseClient,
  event: BookingEmailEvent,
  employeeId: string,
  build: (employeeName: string) => EmailContent,
  refs: EmailRefs = {},
) {
  let subject: string = event;
  let recipient: string | null = null;
  try {
    const { data: employee } = await supabaseAdmin.from("employees").select("full_name, email").eq("id", employeeId).maybeSingle();
    const name = (employee?.full_name as string | undefined)?.split(" ")[0] || "there";
    const content = build(name);
    subject = content.subject;
    recipient = (employee?.email as string | undefined)?.trim() || null;

    const config = await loadConfig(supabaseAdmin);
    if (!config) {
      await log(supabaseAdmin, { event, employee_id: employeeId, recipient, subject, status: "skipped", error: "SMTP is not configured" }, refs);
      return;
    }
    if (!recipient) {
      await log(supabaseAdmin, { event, employee_id: employeeId, recipient, subject, status: "skipped", error: "employee has no email" }, refs);
      return;
    }

    const { text, html } = render(name, content, config.portalUrl);
    await sendSmtp({ ...config, to: recipient, subject, text, html });
    await log(supabaseAdmin, { event, employee_id: employeeId, recipient, subject, status: "sent" }, refs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`booking email ${event} to ${employeeId} failed:`, message);
    await log(supabaseAdmin, { event, employee_id: employeeId, recipient, subject, status: "failed", error: message }, refs).catch(() => {});
  }
}

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

/**
 * Sends after the response: the employee gets their answer without waiting on the mail
 * server. EdgeRuntime.waitUntil keeps the worker alive until it finishes (Supabase runtime);
 * elsewhere (local Deno) the promise just runs.
 */
export function inBackground(promise: Promise<unknown>) {
  const safe = promise.catch((err) => console.error("background email failed:", err));
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(safe);
}

// ── the six emails ───────────────────────────────────────────────────────────────────────

export interface ConferenceEmailInfo {
  roomName: string;
  /** conference_rooms.description — where the room is; shown as "Location" when set. */
  roomDescription?: string | null;
  startsAt: string;
  endsAt: string;
  seatingCount: number;
  eventName: string;
  /** The request's id; shown shortened so the employee can quote it. */
  reference?: string | null;
  /** Reason given on a rejection. */
  note?: string | null;
}

function reference(id?: string | null) {
  return id ? id.slice(0, 8).toUpperCase() : null;
}

export function conferenceEmail(event: "conference_request_sent" | "conference_confirmed" | "conference_rejected", info: ConferenceEmailInfo) {
  const when = formatIstRange(new Date(info.startsAt), new Date(info.endsAt));
  const details: [string, string][] = [
    ["Event", info.eventName],
    ["Room", info.roomName],
    ...(info.roomDescription ? ([["Location", info.roomDescription]] as [string, string][]) : []),
    ["When", `${when} (IST)`],
    ["Sitting arrangement", `${info.seatingCount} seat${info.seatingCount === 1 ? "" : "s"}`],
  ];
  const ref = reference(info.reference);
  if (ref) details.push(["Reference", ref]);
  return (): EmailContent => {
    if (event === "conference_request_sent") {
      return {
        subject: `Conference booking sent (confirmation pending) — ${info.roomName}, ${when}`,
        intro: "We've received your conference room request. It isn't booked yet — the admin team will confirm or decline it, and you'll get another email when they do.",
        details,
        portalPath: "/conference-booking",
      };
    }
    if (event === "conference_confirmed") {
      return {
        subject: `Conference booking confirmed — ${info.roomName}, ${when}`,
        intro: "Your conference room is booked.",
        details,
        portalPath: "/conference-booking",
      };
    }
    return {
      subject: `Conference booking rejected — ${info.roomName}, ${when}`,
      intro: "Your conference room request was declined, so the room hasn't been booked.",
      details,
      outro: info.note ? `Reason: ${info.note}` : "You're welcome to request another time or room.",
      portalPath: "/conference-booking",
    };
  };
}

export interface JourneyEmailInfo {
  routeSummary: string;
  firstPickupAt: string;
  lastDropAt: string;
  passengerCount: number;
  /** "Car name — REG123", once assigned. */
  carLabel?: string | null;
  driverName?: string | null;
  reference?: string | null;
  note?: string | null;
}

function journeyWhen(first: string, last: string) {
  const a = new Date(first);
  const b = new Date(last);
  const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
  return day(a) === day(b) ? `${day(a)}, ${time(a)} – ${time(b)} (IST)` : `${day(a)} ${time(a)} – ${day(b)} ${time(b)} (IST)`;
}

/**
 * A planned journey's details for its Confirmed email, plus its employee passengers (the
 * recipients when an admin plans a journey directly). Null if it can't be read — the caller
 * then just skips the email.
 */
export async function loadJourneyForEmail(
  supabaseAdmin: SupabaseClient,
  journeyId: string,
): Promise<{ info: JourneyEmailInfo; employeePassengerIds: string[] } | null> {
  const { data, error } = await supabaseAdmin
    .from("journeys")
    .select(
      "first_pickup_at, last_drop_at, vehicle:vehicles(name, registration_number), driver:drivers(full_name), journey_guests(employee_id), journey_stops(location_name, sequence_no)",
    )
    .eq("id", journeyId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as {
    first_pickup_at: string;
    last_drop_at: string;
    vehicle: { name: string; registration_number: string } | null;
    driver: { full_name: string } | null;
    journey_guests: { employee_id: string | null }[];
    journey_stops: { location_name: string; sequence_no: number }[];
  };
  return {
    info: {
      routeSummary: [...row.journey_stops].sort((a, b) => a.sequence_no - b.sequence_no).map((s) => s.location_name).join(" → "),
      firstPickupAt: row.first_pickup_at,
      lastDropAt: row.last_drop_at,
      passengerCount: row.journey_guests.length,
      carLabel: row.vehicle ? `${row.vehicle.name} — ${row.vehicle.registration_number}` : null,
      driverName: row.driver?.full_name ?? null,
    },
    employeePassengerIds: row.journey_guests.map((g) => g.employee_id).filter((id): id is string => Boolean(id)),
  };
}

export function journeyEmail(event: "journey_request_sent" | "journey_confirmed" | "journey_rejected", info: JourneyEmailInfo) {
  const when = journeyWhen(info.firstPickupAt, info.lastDropAt);
  const details: [string, string][] = [
    ["Route", info.routeSummary],
    ["When", when],
    ["Passengers", String(info.passengerCount)],
  ];
  if (event === "journey_confirmed") {
    if (info.carLabel) details.push(["Car", info.carLabel]);
    if (info.driverName) details.push(["Driver", info.driverName]);
  }
  const ref = reference(info.reference);
  if (ref) details.push(["Reference", ref]);
  return (): EmailContent => {
    if (event === "journey_request_sent") {
      return {
        subject: `Journey booking sent (confirmation pending) — ${when}`,
        intro: "We've received your journey request. It isn't confirmed yet — the admin team will assign a car and driver, or decline it, and you'll get another email when they do.",
        details,
        portalPath: "/journey-booking",
      };
    }
    if (event === "journey_confirmed") {
      return {
        subject: `Journey booking confirmed — ${when}`,
        intro: "Your journey is confirmed.",
        details,
        portalPath: "/journey-booking",
      };
    }
    return {
      subject: `Journey booking rejected — ${when}`,
      intro: "Your journey request was declined, so no car has been assigned.",
      details,
      outro: info.note ? `Reason: ${info.note}` : "You're welcome to send another request.",
      portalPath: "/journey-booking",
    };
  };
}
