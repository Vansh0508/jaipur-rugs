import { describe, expect, it } from "vitest";
import { extendDueDateForHold, sortChallans } from "../lib/domain/challans";

const base = {
  status: "active" as const,
  priority: "normal" as const,
  dueDate: "2026-09-30",
  createdAt: "2026-09-20T00:00:00Z",
};

describe("Sketch Challan domain rules", () => {
  it("sorts manual priority before due date", () => {
    const rows = [
      { ...base, id: "normal", dueDate: "2026-09-24" },
      { ...base, id: "urgent", priority: "urgent" as const, dueDate: "2026-10-10" },
      { ...base, id: "high", priority: "high" as const, dueDate: "2026-09-25" },
    ];
    expect(sortChallans(rows).map((row) => row.id)).toEqual(["urgent", "high", "normal"]);
  });

  it("extends a date-only due date by every started hold day", () => {
    expect(extendDueDateForHold("2026-09-30", "2026-09-23T12:00:00Z", "2026-09-24T11:59:00Z"))
      .toBe("2026-10-01");
    expect(extendDueDateForHold("2026-09-30", "2026-09-23T12:00:00Z", "2026-09-24T12:01:00Z"))
      .toBe("2026-10-02");
  });
});
