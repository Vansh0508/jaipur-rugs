import { describe, expect, it } from "vitest";
import { DEMO_CHALLANS } from "./demoChallans";
import { applyAction } from "../lib/domain/actions";
import { challanStatusLabel } from "../lib/domain/assignments";

const manager = { role: "manager" as const, sketcherName: "Foxtrot" };
const admin = { role: "admin" as const };
const alpha = { role: "sketcher" as const, sketcherName: "Alpha" };
const row = DEMO_CHALLANS[0]!; // allotted: Alpha on the field (in progress), due 2026-09-25

describe("hold and resume", () => {
  it("only the Sketching Manager and Admin can hold; a held challan shows On hold and can't be worked on", () => {
    expect(() => applyAction(row, { type: "hold", id: row.id }, alpha, "2026-09-24T10:00:00Z")).toThrow(/not allowed/);
    const held = applyAction(row, { type: "hold", id: row.id }, manager, "2026-09-24T10:00:00Z");
    expect(held).toMatchObject({ status: "on_hold", heldAt: "2026-09-24T10:00:00Z" });
    expect(challanStatusLabel(held)).toBe("On hold");
    expect(() => applyAction(held, { type: "status", id: row.id, taskId: "task-1", status: "submitted" }, alpha, "2026-09-24T11:00:00Z")).toThrow(/on hold/);
    expect(() => applyAction(held, { type: "hold", id: row.id }, admin, "2026-09-24T11:00:00Z")).toThrow(/already on hold/);
  });

  it("resuming moves the due date out by the days held and logs it", () => {
    const held = applyAction(row, { type: "hold", id: row.id }, admin, "2026-09-24T10:00:00Z");
    const resumed = applyAction(held, { type: "resume", id: row.id }, manager, "2026-09-27T09:00:00Z");
    expect(resumed.status).toBe("active");
    expect(resumed.heldAt).toBeUndefined();
    expect(resumed.dueDate).toBe("2026-09-28"); // 3 started days on hold
    expect(resumed.activity[0]!.message).toContain("Due date moved from 2026-09-25 to 2026-09-28");
    expect(challanStatusLabel(resumed)).toBe("Done (waiting for approval)"); // one part of this sample is submitted
  });
});
