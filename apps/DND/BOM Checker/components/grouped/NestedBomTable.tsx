"use client";

import React from "react";
import { AuditedBomLine } from "@/lib/audit-engine";
import { AlertCircle, CheckCircle, Layers, FileText, HelpCircle } from "lucide-react";

interface NestedBomTableProps {
  itemNo: string;
  lines: AuditedBomLine[];
  isLoading?: boolean;
  parentIsGrey?: boolean;
  hiddenColumns?: Set<string>;
}

export function NestedBomTable({
  itemNo,
  lines,
  isLoading,
  parentIsGrey = false,
  hiddenColumns,
}: NestedBomTableProps) {
  const isColVisible = (id: string) => !hiddenColumns || !hiddenColumns.has(id);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/80 p-3 shadow-xs bg-white dark:bg-surface">
        {/* Optimistic subheader summary */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              <Layers className="h-3 w-3 animate-pulse text-muted" />
            </span>
            <span className="text-xs font-semibold text-foreground flex items-center gap-2">
              Available BOM Lines
              <span className="inline-block h-3.5 w-7 rounded-full bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
            </span>
            <span className="text-[11px] text-muted font-normal">
              Item: <code className="font-mono font-medium text-foreground">{itemNo}</code>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <div className="h-4 w-24 rounded-full bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
          </div>
        </div>

        {/* Optimistic Nested Table Skeleton */}
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/80 bg-neutral-100/90 dark:bg-neutral-900/60 [&>th]:!bg-neutral-100/90 dark:[&>th]:!bg-neutral-900/60 text-[10px] uppercase tracking-wider text-muted">
                {isColVisible("lineNo") && <th className="py-2 px-2.5 font-semibold">Line No</th>}
                {isColVisible("componentCode") && <th className="py-2 px-2.5 font-semibold">Raw Material / Item</th>}
                {isColVisible("yarnCode") && <th className="py-2 px-2.5 font-semibold">Yarn Code</th>}
                {isColVisible("plannedQty") && <th className="py-2 px-2.5 font-semibold text-right">Planned Qty</th>}
                {isColVisible("stdQty") && <th className="py-2 px-2.5 font-semibold text-right">Std Qty</th>}
                {isColVisible("stdPsf") && <th className="py-2 px-2.5 font-semibold text-right">Std PSF</th>}
                {isColVisible("uom") && <th className="py-2 px-2.5 font-semibold">UOM</th>}
                {isColVisible("status") && <th className="py-2 px-2.5 font-semibold">Audit Status</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {[0, 1, 2, 3].map((i) => {
                const isEven = i % 2 === 0;
                return (
                  <tr
                    key={`skeleton-${i}`}
                    className={`${
                      isEven
                        ? "bg-white dark:bg-surface [&>td]:!bg-white dark:[&>td]:!bg-surface"
                        : "bg-neutral-100/90 dark:bg-neutral-900/60 [&>td]:!bg-neutral-100/90 dark:[&>td]:!bg-neutral-900/60"
                    }`}
                  >
                    {isColVisible("lineNo") && (
                      <td className="py-2.5 px-2.5">
                        <div className="h-3 w-8 rounded bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
                      </td>
                    )}
                    {isColVisible("componentCode") && (
                      <td className="py-2.5 px-2.5">
                        <div className="h-3 w-28 rounded bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
                      </td>
                    )}
                    {isColVisible("yarnCode") && (
                      <td className="py-2.5 px-2.5">
                        <div className="h-4 w-12 rounded bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
                      </td>
                    )}
                    {isColVisible("plannedQty") && (
                      <td className="py-2.5 px-2.5 text-right">
                        <div className="ml-auto h-3 w-12 rounded bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
                      </td>
                    )}
                    {isColVisible("stdQty") && (
                      <td className="py-2.5 px-2.5 text-right">
                        <div className="ml-auto h-3 w-12 rounded bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
                      </td>
                    )}
                    {isColVisible("stdPsf") && (
                      <td className="py-2.5 px-2.5 text-right">
                        <div className="ml-auto h-3 w-14 rounded bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
                      </td>
                    )}
                    {isColVisible("uom") && (
                      <td className="py-2.5 px-2.5">
                        <div className="h-3 w-6 rounded bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
                      </td>
                    )}
                    {isColVisible("status") && (
                      <td className="py-2.5 px-2.5">
                        <div className="h-4 w-16 rounded-full bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!lines || lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center text-xs text-muted rounded-xl border border-border/80 bg-white dark:bg-surface">
        <FileText className="h-5 w-5 text-neutral-400" />
        <p className="font-medium text-foreground">No BOM records found</p>
        <p className="text-[11px]">No active bill of materials is registered in NAV-004 for item <code className="font-mono text-foreground font-semibold">{itemNo}</code>.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/80 p-3 shadow-xs bg-white dark:bg-surface">
      {/* Subheader summary */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
            <Layers className="h-3 w-3" />
          </span>
          <span className="text-xs font-semibold text-foreground">
            Available BOM Lines ({lines.length})
          </span>
          <span className="text-[11px] text-muted font-normal">
            BOM No: <code className="font-mono font-medium text-foreground">{lines[0]?.bomNo || "N/A"}</code>
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {lines.some((l) => l.status === "UNREGISTERED_PREFIX") ? (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              <HelpCircle className="h-3.5 w-3.5" />
              Unregistered Prefix
            </span>
          ) : lines.some((l) => l.status !== "VALID") ? (
            <span className="inline-flex items-center gap-1 text-danger font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              {lines.filter((l) => l.status !== "VALID").length} Discrepanc{lines.filter((l) => l.status !== "VALID").length === 1 ? "y" : "ies"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle className="h-3.5 w-3.5" />
              All Lines Valid
            </span>
          )}
        </div>
      </div>

      {/* Nested Table */}
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border/80 bg-neutral-100/90 dark:bg-neutral-900/60 [&>th]:!bg-neutral-100/90 dark:[&>th]:!bg-neutral-900/60 text-[10px] uppercase tracking-wider text-muted">
              {isColVisible("lineNo") && <th className="py-2.5 px-2.5 font-semibold">Line No</th>}
              {isColVisible("componentCode") && <th className="py-2.5 px-2.5 font-semibold">Raw Material / Item</th>}
              {isColVisible("yarnCode") && <th className="py-2.5 px-2.5 font-semibold">Yarn Code</th>}
              {isColVisible("plannedQty") && <th className="py-2.5 px-2.5 font-semibold text-right">Planned Qty</th>}
              {isColVisible("stdQty") && <th className="py-2.5 px-2.5 font-semibold text-right">Std Qty</th>}
              {isColVisible("stdPsf") && <th className="py-2.5 px-2.5 font-semibold text-right">Std PSF</th>}
              {isColVisible("uom") && <th className="py-2.5 px-2.5 font-semibold">UOM</th>}
              {isColVisible("status") && <th className="py-2.5 px-2.5 font-semibold">Audit Status</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {lines.map((line, idx) => {
              const yarnCode = line.rawRow?.["Yarn Code"] || "-";
              const isDiscrepant = line.status !== "VALID";
              const isEven = idx % 2 === 0;

              return (
                <tr
                  key={`${line.bomNo}-${line.lineNo}-${idx}`}
                  className={`transition-colors border-b border-border/30 ${
                    line.status === "UNREGISTERED_PREFIX"
                      ? "bg-amber-50/40 dark:bg-amber-950/20 [&>td]:!bg-amber-50/40 dark:[&>td]:!bg-amber-950/20"
                      : isDiscrepant
                      ? "bg-rose-50/50 dark:bg-rose-950/30 [&>td]:!bg-rose-50/50 dark:[&>td]:!bg-rose-950/30"
                      : isEven
                      ? "bg-white dark:bg-surface [&>td]:!bg-white dark:[&>td]:!bg-surface"
                      : "bg-neutral-100/90 dark:bg-neutral-900/60 [&>td]:!bg-neutral-100/90 dark:[&>td]:!bg-neutral-900/60"
                  } hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 hover:[&>td]:!bg-neutral-200/60 dark:hover:[&>td]:!bg-neutral-800/60`}
                >
                  {isColVisible("lineNo") && (
                    <td className="py-2.5 px-2.5 font-mono text-muted text-[11px]">{line.lineNo}</td>
                  )}
                  {isColVisible("componentCode") && (
                    <td
                      className="py-2.5 px-2.5 font-mono font-medium text-foreground"
                      title={line.componentDescription}
                    >
                      {line.componentCode || "-"}
                    </td>
                  )}
                  {isColVisible("yarnCode") && (
                    <td className="py-2.5 px-2.5 font-mono font-semibold text-foreground">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                          line.status === "INVALID_CODE"
                            ? "bg-danger text-white font-bold"
                            : "bg-surface text-foreground border border-border/80 shadow-2xs font-medium"
                        }`}
                      >
                        {yarnCode}
                      </span>
                    </td>
                  )}
                  {isColVisible("plannedQty") && (
                    <td className="py-2 px-2.5 text-right font-medium text-foreground">
                      {line.plannedQty ? Number(line.plannedQty).toFixed(3) : "-"}
                    </td>
                  )}
                  {isColVisible("stdQty") && (
                    <td className="py-2 px-2.5 text-right text-muted">
                      {line.expectedQty ? Number(line.expectedQty).toFixed(3) : line.rawRow?.["Standard Qty"] ? Number(line.rawRow["Standard Qty"]).toFixed(3) : "-"}
                    </td>
                  )}
                  {isColVisible("stdPsf") && (
                    <td className="py-2 px-2.5 text-right text-muted">
                      {line.standardPsf ? Number(line.standardPsf).toFixed(4) : line.rawRow?.["Standard PSF"] ? Number(line.rawRow["Standard PSF"]).toFixed(4) : "-"}
                    </td>
                  )}
                  {isColVisible("uom") && (
                    <td className="py-2 px-2.5 text-muted text-[11px]">{line.unitOfMeasure || line.rawRow?.["Unit of Measure Code"] || "KG"}</td>
                  )}
                  {isColVisible("status") && (
                    <td className="py-2 px-2.5">
                      {line.status === "VALID" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                          <CheckCircle className="h-2.5 w-2.5" />
                          Valid
                        </span>
                      )}
                      {line.status === "INVALID_CODE" && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300"
                          title={line.statusMessage}
                        >
                          <AlertCircle className="h-2.5 w-2.5" />
                          Invalid Code ({yarnCode})
                        </span>
                      )}
                      {line.status === "BELOW_AVG_QUANTITY" && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
                          title={line.statusMessage}
                        >
                          <AlertCircle className="h-2.5 w-2.5" />
                          Low Qty
                        </span>
                      )}
                      {line.status === "UNREGISTERED_PREFIX" && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80"
                          title={line.statusMessage}
                        >
                          <HelpCircle className="h-2.5 w-2.5" />
                          Unregistered
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
