import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const dir = mkdtempSync(path.join(tmpdir(), "demo-auth-"));
const accountsFile = path.join(dir, "accounts.json");
writeFileSync(accountsFile, JSON.stringify([
  { username: "admin", password: "a", name: "Admin", role: "admin" },
  { username: "alpha", password: "z", name: "Alpha", role: "sketcher", sketcherName: "Alpha" },
  { username: "bad", password: "b", name: "Bad", role: "owner" },
  { username: "Rack@Example.com", name: "Rack Management", role: "rack" }, // Supabase login: no password in the file
]));
process.env.SKETCH_CHALLAN_DEMO_SECRET = "test-secret";
process.env.SKETCH_CHALLAN_DEMO_ACCOUNTS = accountsFile;
const { authenticate, demoCookieValue, getDemoSession } = await import("../lib/demoAuth");
const FILE_ONLY = { url: "", anonKey: "" };
const SUPABASE = { url: "http://supabase.test", anonKey: "anon" };

describe("sign in", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("without a Supabase URL, uses the file's passwords and skips invalid roles", async () => {
    expect((await authenticate(" Alpha ", "z", FILE_ONLY)) as { sketcherName?: string }).toMatchObject({ sketcherName: "Alpha" });
    expect(await authenticate("alpha", "wrong", FILE_ONLY)).toBeUndefined();
    expect(await authenticate("bad", "b", FILE_ONLY)).toBeUndefined();
    expect(await authenticate("rack@example.com", "", FILE_ONLY)).toBeUndefined(); // no password in the file = no file login
  });

  it("with a Supabase URL, checks the password there and the role in the file", async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => new Response("{}", { status: JSON.parse(String(init.body)).password === "right" ? 200 : 400 }));
    vi.stubGlobal("fetch", fetch);
    expect(await authenticate("RACK@example.com", "right", SUPABASE)).toMatchObject({ username: "rack@example.com", role: "rack" });
    expect(fetch.mock.calls[0]![0]).toBe("http://supabase.test/auth/v1/token?grant_type=password");
    expect(await authenticate("rack@example.com", "wrong", SUPABASE)).toBeUndefined();
    expect(await authenticate("stranger@example.com", "right", SUPABASE)).toBe("no-access"); // real account, not added to the file
  });

  it("accepts only a cookie the server signed", () => {
    expect(getDemoSession(demoCookieValue("admin"))?.role).toBe("admin");
    expect(getDemoSession("admin")).toBeUndefined(); // the old, forgeable format
    expect(getDemoSession("admin.forged")).toBeUndefined();
    const alpha = demoCookieValue("alpha");
    expect(getDemoSession(`admin.${alpha.split(".")[1]}`)).toBeUndefined(); // someone else's signature
    expect(getDemoSession(alpha)?.sketcherName).toBe("Alpha");
    expect(getDemoSession(demoCookieValue("rack@example.com"))?.role).toBe("rack");
  });
});
