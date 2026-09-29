// The real roster is staff data, so it never goes in git (the repo is public). Set it in the git-ignored .env.local
// before `pnpm build`, as "Name:EmployeeId" pairs: NEXT_PUBLIC_SKETCH_CHALLAN_ROSTER="Name One:1234,Name Two:5678".
// It is baked into the build (client lists and server checks read the same value). Unset = sample names for dev/tests.
// The Sketching Manager is on the roster too when he takes parts himself; his login's sketcherName must match.
const SAMPLE_ROSTER = "Alpha:9001,Bravo:9002,Charlie:9003,Delta:9004,Echo:9005,Foxtrot:9006";

// The second value is the person's Employee Id (user, 2026-09-29; it used to be the machine-centre no.).
export function parseRoster(value: string): { name: string; employeeId: string }[] {
  return value.split(",").map((pair) => {
    const [name = "", employeeId = ""] = pair.split(":").map((part) => part.trim());
    return { name, employeeId };
  }).filter((person) => person.name);
}

export const SKETCHER_ROSTER = parseRoster(process.env.NEXT_PUBLIC_SKETCH_CHALLAN_ROSTER || SAMPLE_ROSTER);

// "rack" = the rack management login: sees only the Maps screen (user, 2026-09-29).
export type DemoRole = "manager" | "sketcher" | "admin" | "rack";

export function employeeIdFor(name: string): string | undefined {
  return SKETCHER_ROSTER.find((person) => person.name === name)?.employeeId || undefined;
}
