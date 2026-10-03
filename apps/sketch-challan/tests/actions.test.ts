import { describe, expect, it } from "vitest";
import { DEMO_CHALLANS } from "./demoChallans";
import { applyAction } from "../lib/domain/actions";
import { pendingChange } from "../lib/domain/approval";

const now = "2026-09-24T10:00:00Z";
const manager = { role: "manager" as const, sketcherName: "Foxtrot" };
const admin = { role: "admin" as const };
const alpha = { role: "sketcher" as const, sketcherName: "Alpha" };
const [allotted, blocked, , fresh] = DEMO_CHALLANS as [typeof DEMO_CHALLANS[0], typeof DEMO_CHALLANS[0], unknown, typeof DEMO_CHALLANS[0]];

describe("server-side action rules", () => {
  it("locks allotted challans for the manager but not new ones", () => {
    expect(applyAction(fresh, { type: "patch", id: fresh.id, patch: { priority: "urgent" }, message: "p" }, manager, now).priority).toBe("urgent");
    expect(() => applyAction(allotted, { type: "patch", id: allotted.id, patch: { design: "X" }, message: "p" }, manager, now)).toThrow();
  });

  it("lets the manager add another person to an allotted challan, but not a sketcher", () => {
    const more = { type: "assign" as const, id: allotted.id, parts: [{ sketcherName: "Echo", assignedPart: "Border" }] };
    const added = applyAction(allotted, more, manager, now);
    expect(added.tasks).toHaveLength(allotted.tasks.length + 1);
    expect(added.tasks.at(-1)).toMatchObject({ sketcherName: "Echo", assignedPart: "Border", status: "assigned" });
    expect(() => applyAction(allotted, more, alpha, now)).toThrow();
    expect(() => applyAction({ ...allotted, status: "on_hold" }, more, manager, now)).toThrow(/on hold/);
  });

  it("routes a manager handover to admin, and only admin can approve it", () => {
    const handover = { taskId: "task-3", sketcherName: "Echo", effectiveOn: "2026-09-24", reason: "Leave", excludedDates: [] };
    const requested = applyAction(blocked, { type: "requestChange", id: blocked.id, changes: {}, reason: "Leave", handover }, manager, now);
    const request = pendingChange(requested)!;
    expect(() => applyAction(requested, { type: "reviewChange", id: blocked.id, requestId: request.id, approved: true, note: "" }, manager, now)).toThrow();
    const done = applyAction(requested, { type: "reviewChange", id: blocked.id, requestId: request.id, approved: true, note: "" }, admin, now);
    expect(done.tasks[0]?.sketcherName).toBe("Echo");
  });

  it("lets a sketcher touch only their own task and remark", () => {
    const submitted = applyAction(allotted, { type: "status", id: allotted.id, taskId: "task-1", status: "submitted" }, alpha, now);
    expect(submitted.tasks.find((task) => task.id === "task-1")?.status).toBe("submitted");
    expect(() => applyAction(allotted, { type: "status", id: allotted.id, taskId: "task-2", status: "in_progress" }, alpha, now)).toThrow();
    expect(() => applyAction(allotted, { type: "patch", id: allotted.id, patch: { design: "X" }, message: "p" }, alpha, now)).toThrow();
    expect(() => applyAction(fresh, { type: "patch", id: fresh.id, patch: { sketcherRemark: "hi" }, message: "p" }, alpha, now)).toThrow();
  });

  it("accepts only form fields of the right type in a patch", () => {
    const crafted = { tasks: [{ id: "x", status: "completed" }], status: "cancelled" } as never;
    expect(() => applyAction(fresh, { type: "patch", id: fresh.id, patch: crafted, message: "p" }, manager, now)).toThrow(/can't be edited/);
    expect(() => applyAction(fresh, { type: "patch", id: fresh.id, patch: { quantity: "9" } as never, message: "p" }, manager, now)).toThrow(/invalid/);
    expect(() => applyAction(fresh, { type: "patch", id: fresh.id, patch: { priority: "top" } as never, message: "p" }, manager, now)).toThrow(/invalid/);
    expect(applyAction(fresh, { type: "patch", id: fresh.id, patch: { quantity: 2, design: "D" }, message: "p" }, manager, now).quantity).toBe(2);
  });

  it("lets a sketcher only start once and never mark their own part completed", () => {
    expect(() => applyAction(allotted, { type: "status", id: allotted.id, taskId: "task-1", status: "in_progress" }, alpha, now)).toThrow(/already started/);
    expect(() => applyAction(allotted, { type: "status", id: allotted.id, taskId: "task-1", status: "completed" as never }, alpha, now)).toThrow();
  });

  it("assigns only listed sketchers (the manager included) and no duplicate part", () => {
    const part = (sketcherName: string, assignedPart = "Border") => ({ type: "assign" as const, id: fresh.id, parts: [{ sketcherName, assignedPart }] });
    expect(() => applyAction(fresh, part("Nobody"), manager, now)).toThrow(/from the list/);
    expect(() => applyAction(fresh, { ...part("Echo"), parts: [{ sketcherName: "Echo", assignedPart: "Border" }, { sketcherName: "Echo", assignedPart: "Border" }] }, manager, now)).toThrow(/already has/);
    expect(applyAction(fresh, part("Echo"), manager, now).tasks).toHaveLength(1);
  });

  it("lets the manager work a part he took himself, and approve it as manager", () => {
    const own = applyAction(fresh, { type: "assign", id: fresh.id, parts: [{ sketcherName: "Foxtrot", assignedPart: "Border" }] }, manager, now);
    const taskId = own.tasks[0]!.id;
    const started = applyAction(own, { type: "status", id: own.id, taskId, status: "in_progress" }, manager, now);
    const done = applyAction(started, { type: "status", id: own.id, taskId, status: "submitted" }, manager, now);
    expect(applyAction(done, { type: "reviewTask", id: own.id, taskId, approved: true, note: "" }, manager, now).tasks[0]?.status).toBe("completed");
    expect(() => applyAction(own, { type: "status", id: own.id, taskId, status: "in_progress" }, admin, now)).toThrow();
  });

  it("gives the sketcher remark to the new holder after a handover", () => {
    const moved = applyAction(allotted, { type: "handover", id: allotted.id, taskId: "task-1", sketcherName: "Echo", effectiveOn: "2026-09-24", reason: "Leave", excludedDates: [] }, admin, now);
    const remark = { type: "patch" as const, id: allotted.id, patch: { sketcherRemark: "note" }, message: "p" };
    expect(() => applyAction(moved, remark, alpha, now)).toThrow();
    expect(applyAction(moved, remark, { role: "sketcher", sketcherName: "Echo" }, now).sketcherRemark).toBe("note");
    expect(() => applyAction(allotted, { type: "handover", id: allotted.id, taskId: "task-1", sketcherName: "Nobody", effectiveOn: "2026-09-24", reason: "x", excludedDates: [] }, admin, now)).toThrow(/from the list/);
  });
});
