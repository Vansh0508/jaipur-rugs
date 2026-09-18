export function displayDate(value: string | null | undefined): string {
  if (!value) return "—";
  return Number(value.slice(0, 4)) < 1900 ? "—" : value;
}
