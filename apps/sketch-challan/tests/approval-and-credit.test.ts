import { describe, expect, it } from "vitest";
import { DEMO_CHALLANS } from "./demoChallans";
import { pendingChange, requestDetailChange, reviewDetailChange } from "../lib/domain/approval";
import { challanStage, reviewTask, rowsForSketcher, transferTask } from "../lib/domain/assignments";
import { assignmentWorkdays, countWorkdays } from "../lib/domain/workdays";

const now = "2026-09-24T10:00:00Z";

describe("allotted challan changes", () => {
  it("keeps manager changes pending until the admin approves the exact proposal", () => {
    const original = DEMO_CHALLANS[0]!;
    const requested = requestDetailChange(original, { design: "D-NEW" }, "Corrected design", now, "request-1");
    expect(requested.design).toBe(original.design);
    expect(pendingChange(requested)?.changes).toEqual({ design: "D-NEW" });
    expect(() => requestDetailChange(requested, { border: "Blue" }, "More edits", now, "request-2")).toThrow();

    const approved = reviewDetailChange(requested, "request-1", true, now);
    expect(approved.design).toBe("D-NEW");
    expect(pendingChange(approved)).toBeUndefined();
    expect(approved.changeRequests?.[0]?.status).toBe("approved");
  });

  it("applies a manager's handover only after admin approval", () => {
    const original = DEMO_CHALLANS[1]!; // Charlie alone, started 2026-09-22
    const handover = { taskId: "task-3", sketcherName: "Echo", effectiveOn: "2026-09-24", reason: "Charlie on leave", excludedDates: [] };
    const requested = requestDetailChange(original, {}, "Charlie on leave", now, "request-h", handover);
    expect(requested.tasks[0]?.sketcherName).toBe("Charlie");
    expect(() => requestDetailChange(original, {}, "x", now, "bad", { ...handover, sketcherName: "Charlie" })).toThrow();
    const approved = reviewDetailChange(requested, "request-h", true, now);
    expect(approved.tasks[0]?.sketcherName).toBe("Echo");
    expect(approved.tasks[0]?.assignments).toHaveLength(2);
  });

  it("rejects without changing challan details", () => {
    const original = DEMO_CHALLANS[0]!;
    const requested = requestDetailChange(original, { priority: "low" }, "Update priority", now, "request-1");
    expect(() => reviewDetailChange(requested, "request-1", false, now)).toThrow();
    const rejected = reviewDetailChange(requested, "request-1", false, now, "Keep urgent");
    expect(rejected.priority).toBe("urgent");
    expect(rejected.changeRequests?.[0]?.status).toBe("rejected");
  });
});

describe("sketcher visibility", () => {
  it("shows a sketcher only their challans and their own tasks", () => {
    const alpha = rowsForSketcher(DEMO_CHALLANS, "Alpha");
    expect(alpha.map((row) => row.id)).toEqual(["demo-1"]);
    expect(alpha[0]?.tasks.map((task) => task.sketcherName)).toEqual(["Alpha"]);
    expect(rowsForSketcher(DEMO_CHALLANS, "Nobody")).toEqual([]);
  });
});

describe("manager check of submitted work", () => {
  it("approves into Approved, or sends back to assigned with a note", () => {
    const row = DEMO_CHALLANS[0]!;
    expect(challanStage(row)).toBe("review");
    expect(() => reviewTask(row, "task-2", false, " ", now)).toThrow();
    const back = reviewTask(row, "task-2", false, "Border corners off", now);
    expect(back.tasks.find((task) => task.id === "task-2")?.status).toBe("assigned");
    expect(back.tasks.find((task) => task.id === "task-2")?.assignments?.at(-1)?.endedOn).toBeUndefined();
    expect(challanStage(back)).toBe("allotted");
    const approved = reviewTask(row, "task-2", true, "", now);
    expect(approved.tasks.find((task) => task.id === "task-2")?.status).toBe("completed");
    expect(challanStage(DEMO_CHALLANS[2]!)).toBe("approved");
  });
});

describe("sketcher workday credit", () => {
  it("excludes Sundays and recorded leave dates", () => {
    expect(countWorkdays("2026-09-19", "2026-09-22")).toBe(2);
    expect(countWorkdays("2026-09-19", "2026-09-22", ["2026-09-21"])).toBe(1);
  });

  it("keeps the outgoing sketcher's two days after handover", () => {
    const original = DEMO_CHALLANS[0]!;
    const row = {
      ...original,
      tasks: original.tasks.map((task) => task.id === "task-1" ? {
        ...task,
        assignments: [{ id: "old", sketcherName: "Aditi Sharma", assignedOn: "2026-09-21", startedOn: "2026-09-21" }],
      } : task),
    };
    const transferred = transferTask(row, "task-1", "Pooja Kumawat", "2026-09-24", "Aditi on leave", ["2026-09-23"], "new", now);
    const task = transferred.tasks.find((item) => item.id === "task-1")!;
    expect(task.sketcherName).toBe("Pooja Kumawat");
    expect(assignmentWorkdays(task.assignments![0]!)).toBe(2);
    expect(assignmentWorkdays(task.assignments![1]!)).toBe(0);
    expect(task.assignments![0]?.transferReason).toBe("Aditi on leave");
  });
});
