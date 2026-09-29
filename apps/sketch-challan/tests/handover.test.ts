import { describe, expect, it } from "vitest";
import { DEMO_CHALLANS } from "./demoChallans";
import { applyAction } from "../lib/domain/actions";
import { pendingChange } from "../lib/domain/approval";
import { rowsForSketcher } from "../lib/domain/assignments";

const manager = { role: "manager" as const, sketcherName: "Foxtrot" };
const alpha = { role: "sketcher" as const, sketcherName: "Alpha" };
const row = DEMO_CHALLANS[0]!; // allotted: task-1 is Alpha's

describe("handover by the Sketching Manager (29 Sep meeting)", () => {
  it("applies at once, with no admin request, and the reason is optional", () => {
    const moved = applyAction(row, { type: "handover", id: row.id, taskId: "task-1", sketcherName: "Echo", effectiveOn: "2026-09-24", reason: "", excludedDates: [] }, manager, "2026-09-24T10:00:00Z");
    expect(moved.tasks.find((task) => task.id === "task-1")?.sketcherName).toBe("Echo");
    expect(pendingChange(moved)).toBeUndefined();
    expect(moved.activity[0]!.message).toMatch(/handed over from Alpha to Echo/);
    // Alpha keeps the part in their history as handed over; Echo now holds it.
    expect(rowsForSketcher([moved], "Alpha")).toHaveLength(1);
    expect(rowsForSketcher([moved], "Echo")[0]?.tasks[0]?.sketcherName).toBe("Echo");
  });

  it("a sketcher can't hand over", () => {
    expect(() => applyAction(row, { type: "handover", id: row.id, taskId: "task-1", sketcherName: "Echo", effectiveOn: "2026-09-24", reason: "x", excludedDates: [] }, alpha, "t")).toThrow(/not allowed/);
  });
});
