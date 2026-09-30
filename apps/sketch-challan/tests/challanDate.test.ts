import { describe, expect, it, vi, afterEach } from "vitest";
import { DEMO_CHALLANS } from "./demoChallans";
import { applyAction } from "../lib/domain/actions";
import { shownChallanDate } from "../lib/domain/assignments";

const manager = { role: "manager" as const, sketcherName: "Foxtrot" };
const fresh = DEMO_CHALLANS[3]!; // new (no parts), stored challan date 2026-09-24

describe("challan date = the day it goes out", () => {
  afterEach(() => vi.useRealTimers());

  it("a new challan shows today, or a later day Karam chose", () => {
    expect(shownChallanDate({ ...fresh, challanDate: "2026-09-24" }, "2026-09-29")).toBe("2026-09-29");
    expect(shownChallanDate({ ...fresh, challanDate: "" }, "2026-09-29")).toBe("2026-09-29");
    expect(shownChallanDate({ ...fresh, challanDate: "2026-10-02" }, "2026-09-29")).toBe("2026-10-02");
  });

  it("can't be set before today, and allotting moves a past date to today", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-29T06:00:00Z"));
    expect(() => applyAction(fresh, { type: "patch", id: fresh.id, patch: { challanDate: "2026-09-28" }, message: "d" }, manager, "t")).toThrow(/before today/);
    expect(applyAction(fresh, { type: "patch", id: fresh.id, patch: { challanDate: "2026-09-30" }, message: "d" }, manager, "t").challanDate).toBe("2026-09-30");
    const allotted = applyAction(fresh, { type: "assign", id: fresh.id, parts: [{ sketcherName: "Alpha", assignedPart: "Border" }] }, manager, "t");
    expect(allotted.challanDate).toBe("2026-09-29");
    expect(shownChallanDate(allotted, "2026-10-05")).toBe("2026-09-29"); // keeps the day it went out
  });
});
