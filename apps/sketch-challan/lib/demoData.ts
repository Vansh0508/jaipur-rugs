import { SKETCHER_ROSTER } from "./sketcherRoster";

// Everyone who can be given work. Used by every Assign / Hand over list and re-checked on the server.
export const DEMO_SKETCHERS: string[] = SKETCHER_ROSTER.map((person) => person.name);
