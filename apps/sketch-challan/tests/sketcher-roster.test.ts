import { describe, expect, it } from "vitest";
import { parseRoster, SKETCHER_ROSTER } from "../lib/sketcherRoster";

describe("sketcher roster", () => {
  it("reads Name:EmployeeId pairs from the env value", () => {
    expect(parseRoster(" One Name:1234 , Two:5678,,Three")).toEqual([
      { name: "One Name", employeeId: "1234" }, { name: "Two", employeeId: "5678" }, { name: "Three", employeeId: "" },
    ]);
  });

  it("falls back to sample names when the env value is unset", () => {
    expect(SKETCHER_ROSTER.map((person) => person.name)).toEqual(["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"]);
  });
});
