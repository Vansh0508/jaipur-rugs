/**
 * SQL guardrails. Ported from jrgpt/ask.py `validate()` in the Tableau repo, where the
 * same rules pass a 10-attack suite with zero false positives.
 *
 * This runs on ANY sql that did not come from lib/queries.ts — i.e. anything a model
 * wrote. It is in place before the model exists on purpose, so there is never a window
 * where generated SQL reaches the warehouse unchecked.
 */

export const ALLOWED_VIEWS = [
  "jrgpt.sales_invoiced",
  "jrgpt.open_orders",
  "jrgpt.customers",
  "jrgpt.customers_mv",
  "jrgpt.products",
  "jrgpt.products_mv",
  "jrgpt.production_wip",
  "jrgpt.artisan_activity",
  "jrgpt.receivables",
  "jrgpt.fg_stock",
] as const;

export const MAX_ROWS = 1000;

const FORBIDDEN =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|refresh|call|do|merge|comment|reindex|cluster|listen|notify|lock|pg_read_file|pg_ls_dir|pg_sleep|dblink|lo_import|lo_export)\b/i;

export class UnsafeSql extends Error {}

/** Blank out string literals so their contents can't trip the other checks. */
function withoutLiterals(sql: string): string {
  return sql.replace(/'(?:''|[^'])*'/g, "''");
}

/**
 * Throws UnsafeSql unless `sql` is a single read-only SELECT over allowlisted views.
 * Returns the normalised statement (trailing semicolon stripped).
 */
export function validate(sql: string): string {
  const statement = sql.trim().replace(/;\s*$/, "").trim();
  if (!statement) throw new UnsafeSql("empty statement");

  const bare = withoutLiterals(statement);
  if (bare.includes(";")) throw new UnsafeSql("multiple statements are not allowed");
  if (/--|\/\*/.test(bare)) throw new UnsafeSql("comments are not allowed");
  if (!/^\s*(with|select)\b/i.test(bare)) throw new UnsafeSql("only SELECT statements are allowed");

  const banned = FORBIDDEN.exec(bare);
  if (banned) throw new UnsafeSql(`forbidden keyword: ${banned[0]}`);

  // Every schema-qualified reference must be allowlisted, including the
  // schema."Quoted Name With Spaces" form the raw NAV tables use.
  const allowed = new Set<string>(ALLOWED_VIEWS);
  const refs = new Set<string>();
  for (const m of bare.matchAll(/\b([a-z_][a-z0-9_]*)\s*\.\s*([a-z_][a-z0-9_]*)/gi)) {
    refs.add(`${m[1]!.toLowerCase()}.${m[2]!.toLowerCase()}`);
  }
  for (const m of bare.matchAll(/\b([a-z_][a-z0-9_]*)\s*\.\s*"([^"]+)"/gi)) {
    refs.add(`${m[1]!.toLowerCase()}.${m[2]!.toLowerCase()}`);
  }
  const schemas = new Set(["jrgpt", "nav_mirror", "public", "pg_catalog", "information_schema"]);
  for (const ref of refs) {
    const schema = ref.split(".")[0]!;
    if (schemas.has(schema) && !allowed.has(ref)) throw new UnsafeSql(`table not allowed: ${ref}`);
  }

  const lower = bare.toLowerCase();
  if (![...allowed].some((v) => lower.includes(v))) {
    throw new UnsafeSql("query does not reference any allowed view");
  }
  return statement;
}

/** Append a LIMIT unless the query is already limited or is a single-row aggregate. */
export function addLimit(sql: string): string {
  const lower = sql.toLowerCase();
  if (/\blimit\s+\d+\s*$/.test(lower)) return sql;
  if (/\b(count|sum|avg|min|max|percentile_cont)\s*\(/.test(lower) && !lower.includes("group by")) {
    return sql;
  }
  return `${sql}\nlimit ${MAX_ROWS}`;
}
