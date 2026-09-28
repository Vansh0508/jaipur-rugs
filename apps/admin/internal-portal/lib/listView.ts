// Plain module (not "use client") — the list pages are Server Components and call
// parseListView themselves; a function exported from a client module can't be invoked
// on the server.

export type ListView = "table" | "cards";

/** `?view=cards` → cards; anything else (incl. absent) → the table, which is primary. */
export function parseListView(value: string | undefined): ListView {
  return value === "cards" ? "cards" : "table";
}
