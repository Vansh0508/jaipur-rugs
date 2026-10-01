"use client";

import { useState } from "react";
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid } from "@jaipur-rugs/charts";

export type AnswerPayload = {
  kind: "answer";
  question: string;
  matched: { id: string; label: string; score: number };
  columns: string[];
  rows: (string | number | boolean | null)[][];
  shape: "single" | "metrics" | "series" | "categorical" | "table";
  sql: string;
  tables: string[];
  synced: Record<string, string | null>;
  ms: number;
};

export type BlockedPayload = { kind: "blocked"; question: string; reason: string };
export type UnsurePayload = {
  kind: "unsure";
  question: string;
  alternatives: string[];
  modelNote?: string;
};
export type Turn = AnswerPayload | BlockedPayload | UnsurePayload;

/** cr_inr -> "Cr inr" reads badly; snake_case column names need humanising for display. */
function humanise(col: string): string {
  return col
    .replace(/_/g, " ")
    .replace(/\binr\b/gi, "₹")
    .replace(/\bcr\b/gi, "₹ Cr")
    .replace(/\blakh\b/gi, "lakh")
    .replace(/\bpct\b/gi, "%")
    .replace(/^./, (c) => c.toUpperCase());
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (typeof v !== "boolean" && !Number.isNaN(n) && String(v).trim() !== "") {
    return n % 1 === 0 ? n.toLocaleString("en-IN") : n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  return String(v);
}

/**
 * Three layers, per the interface plan: the answer, then the evidence, then provenance
 * collapsed. The provenance layer is what makes a number defensible in front of a
 * director, so it is always one click away and never more than that.
 */
export function AnswerCard({
  turn,
  onPin,
}: {
  turn: Turn;
  onPin?: (entryId: string, label: string) => void;
}) {
  const [showSql, setShowSql] = useState(false);

  if (turn.kind === "blocked") {
    return (
      <Shell question={turn.question}>
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-small leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
          <strong className="font-semibold">I can&rsquo;t answer that.</strong> {turn.reason}
        </div>
      </Shell>
    );
  }

  if (turn.kind === "unsure") {
    return (
      <Shell question={turn.question}>
        <p className="text-small text-default-500">
          I&rsquo;m not confident enough to answer that one. Did you mean:
        </p>
        {turn.modelNote ? (
          <p className="mt-1.5 text-tiny text-default-400">{turn.modelNote}</p>
        ) : null}
        <ul className="mt-2 flex flex-col gap-1">
          {turn.alternatives.map((a) => (
            <li key={a} className="text-small text-default-700">
              › {a}
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  const { columns, rows, shape } = turn;
  const single = shape === "single" && rows[0]?.[0] !== undefined;
  const metrics = shape === "metrics" && rows[0];

  return (
    <Shell
      question={turn.question}
      matched={turn.matched.label}
      entryId={turn.matched.id}
      onPin={onPin}
    >
      {single ? (
        <div className="py-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
          {fmt(rows[0]![0])}
        </div>
      ) : shape === "series" || shape === "categorical" ? (
        <ChartOrBars columns={columns} rows={rows} />
      ) : null}

      {metrics ? (
        <div className="flex flex-wrap gap-x-9 gap-y-4 py-1">
          {columns.map((c, i) => (
            <div key={c}>
              <div className="text-tiny uppercase tracking-wide text-default-400">{humanise(c)}</div>
              <div className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums sm:text-[28px]">
                {fmt(rows[0]![i])}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!single && !metrics ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th
                    key={c}
                    className={`whitespace-nowrap border-b border-default-200 pb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-default-400 ${i ? "pl-4 text-right" : "text-left"}`}
                  >
                    {humanise(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 15).map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td
                      key={ci}
                      className={`whitespace-nowrap border-b border-default-100 py-1.5 ${ci ? "pl-4 text-right tabular-nums" : "text-left"}`}
                    >
                      {fmt(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 15 ? (
            <p className="pt-2 text-tiny text-default-400">… {rows.length - 15} more rows</p>
          ) : null}
        </div>
      ) : null}

      {/* Source cards — the Resarc pattern, but carrying provenance rather than citations. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {turn.tables.map((t) => {
          const bare = t.replace(/^nav_mirror\."?|"$/g, "");
          const synced = turn.synced[bare];
          return (
            <div key={t} className="rounded-xl border border-default-200 bg-default-100/50 px-3 py-2">
              <div className="font-mono text-[11px] text-default-600">{t}</div>
              <div className="text-[10.5px] text-default-400">{synced ? `synced ${synced}` : "live view"}</div>
            </div>
          );
        })}
        <div className="rounded-xl border border-default-200 bg-default-100/50 px-3 py-2">
          <div className="font-mono text-[11px] text-default-600">{rows.length} rows</div>
          <div className="text-[10.5px] text-default-400">{turn.ms} ms</div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowSql((v) => !v)}
        className="mt-3 text-tiny text-default-400 transition hover:text-foreground"
      >
        {showSql ? "▾" : "▸"} How I got this
      </button>
      {showSql ? (
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-default-100 p-3 font-mono text-[11px] leading-relaxed text-default-600">
          {turn.sql}
        </pre>
      ) : null}
    </Shell>
  );
}

function Shell({
  question,
  matched,
  entryId,
  onPin,
  children,
}: {
  question: string;
  matched?: string;
  entryId?: string;
  onPin?: (entryId: string, label: string) => void;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-default-200 bg-background p-4 sm:p-5">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-small font-medium">{question}</p>
          {matched ? <p className="mt-0.5 text-tiny text-default-400">{matched}</p> : null}
        </div>
        {matched && entryId && onPin ? (
          <button
            type="button"
            onClick={() => onPin(entryId, matched)}
            aria-label="Pin this answer"
            className="shrink-0 rounded-lg border border-default-200 px-2 py-1 text-tiny text-default-500 transition hover:text-foreground"
          >
            Pin
          </button>
        ) : null}
      </div>
      {children}
    </article>
  );
}

/**
 * Bars when the categories are few enough to read; the table below always carries the
 * detail. Bklit, matching apps/admin/internal-portal's RideCountsChart — the house chart
 * package, per AGENTS.md Section 2.
 */
function ChartOrBars({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number | boolean | null)[][];
}) {
  const label = columns[1] ?? "value";
  const data = rows
    .slice(0, 12)
    .map((r) => ({ name: String(r[0] ?? ""), value: Number(r[1] ?? 0) }))
    .filter((d) => !Number.isNaN(d.value));
  if (data.length < 2) return null;

  return (
    <div className="w-full">
      <BarChart
        data={data}
        xDataKey="name"
        aspectRatio="2.6 / 1"
        margin={{ top: 12, right: 8, bottom: 32, left: 8 }}
        barGap={0.35}
      >
        <Grid horizontal numTicksRows={4} />
        <Bar dataKey="value" lineCap={4} />
        <BarXAxis maxLabels={8} />
        <ChartTooltip
          rows={(point) => [
            { color: "var(--chart-line-primary)", label, value: Number(point.value) },
          ]}
        />
      </BarChart>
    </div>
  );
}
