import { NextResponse } from "next/server";
import { TILES, LISTS } from "@/lib/queries";
import { query } from "@/lib/warehouse";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** In-process cache. The warehouse is across a VPN and these are cheap to reuse. */
const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; payload: unknown } | undefined;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({ ...(cache.payload as object), cachedSeconds: Math.round((Date.now() - cache.at) / 1000) });
  }
  try {
    const tiles = await Promise.all(
      TILES.map(async (t) => {
        const { rows, ms } = await query(t.sql);
        const row = rows[0] ?? {};
        return {
          key: t.key, label: t.label, unit: t.unit, sub: t.sub, source: t.source,
          value: row.value ?? null, compare: row.compare ?? null, ms,
        };
      }),
    );
    const lists = await Promise.all(
      LISTS.map(async (l) => {
        const { rows, ms } = await query(l.sql);
        return {
          key: l.key, title: l.title, source: l.source, columns: l.columns,
          rows: rows.map((r) => Object.values(r)), ms,
        };
      }),
    );
    const payload = { tiles, lists, fetchedAt: new Date().toISOString() };
    cache = { at: Date.now(), payload };
    return NextResponse.json({ ...payload, cachedSeconds: 0 });
  } catch (err) {
    // Surface the real cause — a dropped VPN and a broken query look identical otherwise,
    // and we lost real time to that confusion once already.
    const message = err instanceof Error ? err.message : "unknown error";
    const unreachable = /ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|timeout/i.test(message);
    return NextResponse.json(
      {
        error: unreachable ? "warehouse-unreachable" : "query-failed",
        detail: unreachable
          ? "Cannot reach the warehouse at 192.168.0.18. Check the VPN before looking at the app."
          : message,
      },
      { status: 503 },
    );
  }
}
