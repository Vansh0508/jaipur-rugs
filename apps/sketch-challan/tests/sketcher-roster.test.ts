import { describe, expect, it } from "vitest";
import { parseRoster, SKETCHER_ROSTER } from "../lib/sketcherRoster";

describe("sketcher roster", () => {
  it("reads Name:MC pairs from the env value", () => {
    expect(parseRoster(" One Name:MC-101 , Two:MC-102,,Three")).toEqual([
      { name: "One Name", machineCentreNo: "MC-101" }, { name: "Two", machineCentreNo: "MC-102" }, { name: "Three", machineCentreNo: "" },
    ]);
  });

  it("falls back to sample names when the env value is unset", () => {
    expect(SKETCHER_ROSTER.map((person) => person.name)).toEqual(["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"]);
  });
});
