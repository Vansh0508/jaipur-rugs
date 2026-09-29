// The real roster is staff data, so it never goes in git (the repo is public). Set it in the git-ignored .env.local
// before `pnpm build`, as "Name:MC-no" pairs: NEXT_PUBLIC_SKETCH_CHALLAN_ROSTER="Name One:MC-101,Name Two:MC-102".
// It is baked into the build (client lists and server checks read the same value). Unset = sample names for dev/tests.
// The Sketching Manager is on the roster too when he takes parts himself; his login's sketcherName must match.
const SAMPLE_ROSTER = "Alpha:MC-001,Bravo:MC-002,Charlie:MC-003,Delta:MC-004,Echo:MC-005,Foxtrot:MC-006";

export function parseRoster(value: string): { name: string; machineCentreNo: string }[] {
  return value.split(",").map((pair) => {
    const [name = "", machineCentreNo = ""] = pair.split(":").map((part) => part.trim());
    return { name, machineCentreNo };
  }).filter((person) => person.name);
}

export const SKETCHER_ROSTER = parseRoster(process.env.NEXT_PUBLIC_SKETCH_CHALLAN_ROSTER || SAMPLE_ROSTER);

// "rack" = the rack management login: sees only the Maps screen (user, 2026-09-29).
export type DemoRole = "manager" | "sketcher" | "admin" | "rack";

export function machineCentreNoFor(name: string): string | undefined {
  return SKETCHER_ROSTER.find((person) => person.name === name)?.machineCentreNo || undefined;
}
