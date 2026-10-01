import { NextResponse } from "next/server";
import { modelKey } from "@/lib/env";
import { addLimit } from "@/lib/guards";
import { match, shapeOf } from "@/lib/library";
import { freshness, query } from "@/lib/warehouse";

export const dynamic = "force-dynamic";

/**
 * Plain-English question -> SQL -> answer.
 *
 * Order matters: the verified library answers first, and only what it misses would reach a
 * model. That is the semantic-cache/nearest-example layer from the interface plan, and it
 * means the app answers real questions today without a key. Anything a model generates
 * later still goes through guards.validate() before it can touch the warehouse.
 */
export async function POST(request: Request) {
  const { question } = (await request.json().catch(() => ({}))) as { question?: string };
  if (!question || !question.trim()) {
    return NextResponse.json({ error: "empty-question" }, { status: 400 });
  }

  const found = match(question);

  if (found.kind === "blocked") {
    return NextResponse.json({ kind: "blocked", question, reason: found.reason });
  }

  if (found.kind === "unsure") {
    // No model yet, so we cannot generalise past the library. Say so and offer the nearest
    // questions rather than answering something adjacent and wrong.
    return NextResponse.json({
      kind: "unsure",
      question,
      hasModel: Boolean(modelKey()),
      alternatives: found.alternatives.map((a) => a.label),
    });
  }

  const { entry, score } = found;

  // Library SQL is hand-written, reviewed and generated from the verified Python set, so it
  // is trusted the same way lib/queries.ts is — guards.validate() exists for SQL a MODEL
  // wrote, not for ours. Validating it here actively broke correct answers: Q25 and Q26
  // legitimately read raw nav_mirror tables that the model allowlist deliberately excludes.
  // A LIMIT is still applied, because a runaway result set is a footgun either way.
  const sql = addLimit(entry.sql);

  try {
    const { rows, columns, ms } = await query(sql);
    const values = rows.map((r) => columns.map((c) => r[c] ?? null));
    const tables = [...new Set([...sql.matchAll(/\b(?:jrgpt|nav_mirror)\.(?:"[^"]+"|[a-z_]+)/gi)].map((m) => m[0]))];
    const synced = await freshness(
      tables.filter((t) => t.startsWith("nav_mirror.")).map((t) => t.replace(/^nav_mirror\."?|"$/g, "")),
    ).catch(() => ({}));

    return NextResponse.json({
      kind: "answer",
      question,
      matched: { id: entry.id, label: entry.label, score: Math.round(score * 100) / 100 },
      columns,
      rows: values,
      shape: shapeOf(columns, values),
      sql,
      tables,
      synced,
      ms,
    });
  } catch (err) {
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
