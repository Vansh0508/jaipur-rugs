// Turns whatever someone pasted into a clean list of codes. People copy these out of
// Excel/an email/a chat message, which can land as comma-separated, one-per-line, or
// tab-separated (a copied column vs. a copied row) — sometimes a mix. Splitting only on
// commas (the original version of this, InviteMerchantForm's customer-code field) broke
// silently on a pasted column: the whole multi-line blob became one "code." Confirmed
// as a real gap 2026-09-02 while building self-service salesperson-code entry.
//
// Splits on any run of commas, semicolons, or whitespace (including newlines/tabs),
// trims, drops empties, and de-dupes exact matches — deliberately NOT case-folding here
// (a customer number and a salesperson code have different real casing conventions);
// callers normalize case themselves if their kind of code needs it.
export function parseCodeList(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of raw.split(/[,;\s]+/)) {
    const trimmed = token.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}
