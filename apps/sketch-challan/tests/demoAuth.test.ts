import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const dir = mkdtempSync(path.join(tmpdir(), "demo-auth-"));
const accountsFile = path.join(dir, "accounts.json");
writeFileSync(accountsFile, JSON.stringify([
  { username: "admin", password: "a", name: "Admin", role: "admin" },
  { username: "alpha", password: "z", name: "Alpha", role: "sketcher", sketcherName: "Alpha" },
  { username: "bad", password: "b", name: "Bad", role: "owner" },
]));
process.env.SKETCH_CHALLAN_DEMO_SECRET = "test-secret";
process.env.SKETCH_CHALLAN_DEMO_ACCOUNTS = accountsFile;
const { authenticateDemo, demoCookieValue, getDemoSession } = await import("../lib/demoAuth");

describe("demo login", () => {
  it("reads accounts from the git-ignored file, skipping invalid roles", () => {
    expect(authenticateDemo(" Alpha ", "z")?.sketcherName).toBe("Alpha");
    expect(authenticateDemo("alpha", "wrong")).toBeUndefined();
    expect(authenticateDemo("bad", "b")).toBeUndefined();
  });

  it("accepts only a cookie the server signed", () => {
    expect(getDemoSession(demoCookieValue("admin"))?.role).toBe("admin");
    expect(getDemoSession("admin")).toBeUndefined(); // the old, forgeable format
    expect(getDemoSession("admin.forged")).toBeUndefined();
    const alpha = demoCookieValue("alpha");
    expect(getDemoSession(`admin.${alpha.split(".")[1]}`)).toBeUndefined(); // someone else's signature
    expect(getDemoSession(alpha)?.sketcherName).toBe("Alpha");
  });
});
