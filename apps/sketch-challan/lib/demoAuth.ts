import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DemoRole } from "./sketcherRoster";

export const DEMO_COOKIE = "sketch_challan_demo_user";

export interface DemoSession {
  username: string;
  name: string;
  role: DemoRole;
  sketcherName?: string;
}

type Account = DemoSession & { password: string };

const DATA = path.join(/*turbopackIgnore: true*/ process.cwd(), "data"); // runtime data, never part of a build

// Demo logins live in data/demo-accounts.json (git-ignored), never in the source, because the repo is public.
// Entries: { username, password, name, role: "manager" | "sketcher" | "admin" | "rack", sketcherName? }. Edits apply on the
// next request. No file = nobody can sign in (fail closed). SKETCH_CHALLAN_DEMO_ACCOUNTS points elsewhere (tests).
let cache: { file: string; mtimeMs: number; accounts: Account[] } | undefined;
function accounts(): Account[] {
  const file = process.env.SKETCH_CHALLAN_DEMO_ACCOUNTS || path.join(/*turbopackIgnore: true*/ DATA, "demo-accounts.json");
  let mtimeMs: number;
  try { mtimeMs = statSync(/*turbopackIgnore: true*/ file).mtimeMs; } catch { return []; }
  if (cache?.file !== file || cache.mtimeMs !== mtimeMs) {
    const list = JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as Account[];
    cache = { file, mtimeMs, accounts: list.filter((item) => typeof item.username === "string" && typeof item.password === "string" && ["manager", "sketcher", "admin", "rack"].includes(item.role)) };
  }
  return cache.accounts;
}

export function hasDemoAccounts(): boolean {
  return accounts().length > 0;
}

// The cookie is "username.signature", so typing a username into the browser's cookie no longer signs you in.
// Secret: SKETCH_CHALLAN_DEMO_SECRET, else one generated into data/demo-secret on first use. A file (not memory)
// so the proxy and the routes agree even when Next loads this module twice, and sessions survive a restart.
let secret: string | undefined;
function demoSecret(): string {
  if (secret) return secret;
  if (process.env.SKETCH_CHALLAN_DEMO_SECRET) return (secret = process.env.SKETCH_CHALLAN_DEMO_SECRET);
  const file = path.join(/*turbopackIgnore: true*/ DATA, "demo-secret");
  try {
    mkdirSync(/*turbopackIgnore: true*/ DATA, { recursive: true });
    writeFileSync(/*turbopackIgnore: true*/ file, randomBytes(32).toString("hex"), { flag: "wx" }); // "wx": the first writer wins
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return (secret = readFileSync(/*turbopackIgnore: true*/ file, "utf8").trim());
}

function signature(username: string): string {
  return createHmac("sha256", demoSecret()).update(username).digest("base64url");
}

export function demoCookieValue(username: string): string {
  return `${username}.${signature(username)}`;
}

function publicSession(account: Account): DemoSession {
  const { password: _password, ...session } = account;
  return session;
}

export function authenticateDemo(username: string, password: string): DemoSession | undefined {
  const account = accounts().find((item) => item.username === username.trim().toLowerCase() && item.password === password);
  return account ? publicSession(account) : undefined;
}

export function getDemoSession(cookie: string | undefined): DemoSession | undefined {
  const dot = cookie?.lastIndexOf(".") ?? -1;
  if (!cookie || dot < 1) return undefined;
  const username = cookie.slice(0, dot);
  const given = Buffer.from(cookie.slice(dot + 1));
  const expected = Buffer.from(signature(username));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return undefined;
  const account = accounts().find((item) => item.username === username);
  return account ? publicSession(account) : undefined;
}
