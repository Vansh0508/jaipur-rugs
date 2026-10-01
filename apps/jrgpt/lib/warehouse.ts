import "server-only";
import { Pool } from "pg";

/**
 * Read-only client for the NAV mirror (Postgres on .18).
 *
 * Same pattern and same `WAREHOUSE_DATABASE_URL` as apps/analytics/lib/warehouse.ts —
 * deliberately not re-invented. JRGPT only ever reads from here; the one thing this app
 * writes (a user's pinned cards) goes to the shared Supabase project instead.
 *
 * TODO (AGENTS.md §9): move to a dedicated read-only role rather than the admin
 * connection. lib/guards.ts is the interim boundary, but a role is the real one.
 */
let pool: Pool | undefined;

function db(): Pool {
  if (!pool) {
    const url = process.env.WAREHOUSE_DATABASE_URL;
    if (!url) throw new Error("Missing WAREHOUSE_DATABASE_URL");
    pool = new Pool({
      connectionString: url,
      max: 4,
      idleTimeoutMillis: 30_000,
      // The mirror is across a VPN; fail fast rather than hanging a request for minutes.
      connectionTimeoutMillis: 10_000,
      statement_timeout: 20_000,
    });
  }
  return pool;
}

export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;

export type QueryResult = {
  rows: Row[];
  columns: string[];
  ms: number;
};

/** Run a read-only query. Callers that accept model-authored SQL must pass it through guards.ts first. */
export async function query(sql: string, params: unknown[] = []): Promise<QueryResult> {
  const started = Date.now();
  const res = await db().query(sql, params);
  return {
    rows: res.rows as Row[],
    columns: res.fields.map((f) => f.name),
    ms: Date.now() - started,
  };
}

/** Last-sync time per mirrored table, so every answer can state how old its data is. */
export async function freshness(tables: string[]): Promise<Record<string, string | null>> {
  if (tables.length === 0) return {};
  const { rows } = await query(
    `SELECT relname AS table, to_char(greatest(last_vacuum, last_analyze, last_autoanalyze),
            'YYYY-MM-DD HH24:MI') AS synced
       FROM pg_stat_all_tables
      WHERE schemaname = 'nav_mirror' AND relname = ANY($1)`,
    [tables],
  );
  const out: Record<string, string | null> = {};
  for (const r of rows) out[String(r.table)] = r.synced as string | null;
  return out;
}
