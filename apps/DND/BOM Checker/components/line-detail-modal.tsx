"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AuditedBomLine } from "@/lib/audit-engine";
import {
  X,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Layers,
  Info,
  HelpCircle,
  ShieldAlert,
  Database,
  ListOrdered,
} from "lucide-react";
import { Card, Chip, Button, Popover, Typography } from "@heroui/react";
import { ProportionalQuantityChecker } from "./proportional-quantity-checker";

interface LineDetailModalProps {
  line: AuditedBomLine | null;
  allLines?: AuditedBomLine[];
  onClose: () => void;
}

export const LineDetailModal: React.FC<LineDetailModalProps> = ({ line, allLines = [], onClose }) => {
  const [activeLine, setActiveLine] = useState<AuditedBomLine | null>(line);

  // Sync state whenever the selected line prop updates
  useEffect(() => {
    if (line) {
      setActiveLine(line);
    }
  }, [line]);

  // Compute all items / lines belonging to this BOM
  const bomItems = useMemo(() => {
    if (!activeLine) return [];
    const items = allLines.filter((l) => l.bomNo === activeLine.bomNo);
    if (items.length === 0) return [activeLine];
    return [...items].sort((a, b) => (Number(a.lineNo) || 0) - (Number(b.lineNo) || 0));
  }, [allLines, activeLine?.bomNo]);

  if (!line || !activeLine) return null;

  const getStatusExplanation = () => {
    switch (activeLine.status) {
      case "INVALID_CODE":
        return `The yarn/component code "${activeLine.componentCode}" is not found in the 25 approved yarn specifications (Yarn1–Yarn25) registered for design prefix "${activeLine.designPrefix}" in the Final Sheet Data benchmark master. Using unapproved yarn introduces shade and quality deviations in the finished rug.`;
      case "BELOW_AVG_QUANTITY":
        return `The planned transfer quantity (${activeLine.plannedQty.toFixed(2)} KG) is below the benchmark average (${activeLine.expectedQty.toFixed(2)} KG) calculated for standard ${activeLine.size} dimensions. A quantity shortfall of ${activeLine.variancePct}% risks material starvation on the loom during weaving.`;
      case "UNREGISTERED_PREFIX":
        return `The design prefix "${activeLine.designPrefix}" is not present in the master benchmark file "Copy of Design Code Data RND DND DRP.xlsx" marked with Remark == 'Done'. It requires benchmark registration by the D&D team.`;
      case "VALID":
      default:
        return `The planned yarn code "${activeLine.componentCode}" is verified against the approved benchmark yarn list, and the planned quantity conforms to standard rug size proportions.`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <Card className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-0 max-h-[90vh] flex flex-col">
        {/* Header using Hero UI Typography */}
        <Card.Header className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-[#8B1E1E]/10 border border-[#8B1E1E]/20 flex items-center justify-center text-[#8B1E1E]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <Typography type="h3" className="text-base font-bold text-stone-900">
                BOM Line Audit Diagnosis
              </Typography>
              <Typography type="body-xs" color="muted" className="text-stone-500">
                BOM No: {activeLine.bomNo} &bull; Item: {activeLine.itemNo} &bull; Line #{activeLine.lineNo} ({bomItems.length} total items in this BOM)
              </Typography>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            aria-label="Close"
            onClick={onClose}
            className="cursor-pointer text-stone-500 hover:text-stone-800"
          >
            <X className="w-5 h-5" />
          </Button>
        </Card.Header>

        {/* Content */}
        <Card.Content className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* BOM Items & Materials List Strip */}
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 bg-stone-50/90 border-b border-stone-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <ListOrdered className="w-4 h-4 text-[#8B1E1E]" />
                <Typography type="h4" className="text-xs font-bold text-stone-900 tracking-wide uppercase">
                  BOM Items & Materials List ({bomItems.length} {bomItems.length === 1 ? "Line" : "Lines"})
                </Typography>
              </div>
              <Typography type="body-xs" color="muted" className="text-[11px] text-stone-500">
                Select any item to inspect its audit diagnosis
              </Typography>
            </div>

            <div className="overflow-x-auto max-h-48 overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="text-[11px] font-bold uppercase tracking-wider text-stone-600 bg-stone-100/70 sticky top-0 z-10 border-b border-stone-200">
                  <tr>
                    <th className="py-2 px-3 w-12 text-center">#</th>
                    <th className="py-2 px-3">Component / Yarn Code</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-right">Planned Qty</th>
                    <th className="py-2 px-3 text-center">Audit Status</th>
                    <th className="py-2 px-3 text-center w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-sans">
                  {bomItems.map((item, idx) => {
                    const isCurrent =
                      (item.id && item.id === activeLine.id) ||
                      (item.lineNo === activeLine.lineNo && item.componentCode === activeLine.componentCode);

                    return (
                      <tr
                        key={item.id || `line-${idx}-${item.lineNo}`}
                        onClick={() => setActiveLine(item)}
                        className={`cursor-pointer transition-colors ${
                          isCurrent
                            ? "bg-amber-50/70 border-l-3 border-l-[#8B1E1E]"
                            : "hover:bg-stone-50/80 bg-white"
                        }`}
                      >
                        <td className="py-2 px-3 text-center font-mono font-medium text-stone-500 text-[11px]">
                          #{idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-stone-900">
                          <span className="bg-stone-100 px-1.5 py-0.5 rounded text-[11px]">
                            {item.componentCode || "(None)"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-stone-600 truncate max-w-xs text-[11px]">
                          {item.componentDescription || item.quality || "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-stone-900 text-[11px]">
                          {item.plannedQty.toFixed(2)} {item.unitOfMeasure || "KG"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Chip
                            size="sm"
                            variant="soft"
                            color={
                              item.status === "INVALID_CODE"
                                ? "danger"
                                : item.status === "BELOW_AVG_QUANTITY"
                                ? "warning"
                                : item.status === "UNREGISTERED_PREFIX"
                                ? "default"
                                : "success"
                            }
                            className="text-[10px] font-bold"
                          >
                            {item.status === "INVALID_CODE"
                              ? "Unapproved Yarn"
                              : item.status === "BELOW_AVG_QUANTITY"
                              ? "Below Avg"
                              : item.status === "UNREGISTERED_PREFIX"
                              ? "Unregistered"
                              : "Passed"}
                          </Chip>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isCurrent ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#8B1E1E] text-white">
                              Inspecting
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveLine(item);
                              }}
                            >
                              Diagnose
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Status Alert Banner with Hero UI Popover & Typography */}
          <div
            className={`p-4 rounded-xl border flex items-start space-x-3 ${
              activeLine.status === "INVALID_CODE"
                ? "bg-rose-50 border-rose-200 text-rose-900"
                : activeLine.status === "BELOW_AVG_QUANTITY"
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : activeLine.status === "UNREGISTERED_PREFIX"
                ? "bg-slate-50 border-slate-200 text-slate-900"
                : "bg-emerald-50 border-emerald-200 text-emerald-900"
            }`}
          >
            {activeLine.status === "INVALID_CODE" ? (
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
            ) : activeLine.status === "BELOW_AVG_QUANTITY" ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            ) : activeLine.status === "UNREGISTERED_PREFIX" ? (
              <Info className="w-5 h-5 text-slate-600 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center space-x-2">
                  <Typography type="h4" className="text-sm font-bold">
                    {activeLine.status === "INVALID_CODE"
                      ? "Discrepancy: Unapproved Yarn/Component Code"
                      : activeLine.status === "BELOW_AVG_QUANTITY"
                      ? "Discrepancy: Planned Quantity Below Size Benchmark"
                      : activeLine.status === "UNREGISTERED_PREFIX"
                      ? "Notice: Design Prefix Not in 'Done' Benchmark Master"
                      : "Audit Verified: Approved Standard Line"}
                  </Typography>
                  <Chip
                    color={
                      activeLine.status === "INVALID_CODE"
                        ? "danger"
                        : activeLine.status === "BELOW_AVG_QUANTITY"
                        ? "warning"
                        : activeLine.status === "UNREGISTERED_PREFIX"
                        ? "default"
                        : "success"
                    }
                    size="sm"
                    variant="soft"
                    className="font-bold text-[10px]"
                  >
                    {activeLine.error}
                  </Chip>
                </div>

                {/* Hero UI Popover: Diagnosis Rationale */}
                <Popover>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-[11px] h-6 px-2 font-semibold flex items-center space-x-1 cursor-pointer bg-white/80 hover:bg-white shadow-2xs"
                    aria-label="Why this diagnosis?"
                  >
                    <HelpCircle className="w-3 h-3 text-[#8B1E1E]" />
                    <span>Audit Rule Info</span>
                  </Button>
                  <Popover.Content className="max-w-xs shadow-xl border border-stone-200 bg-white p-0 rounded-xl">
                    <Popover.Dialog className="p-4 space-y-2">
                      <Popover.Arrow />
                      <Popover.Heading className="text-xs font-bold text-stone-900 pb-1.5 border-b border-stone-100 flex items-center space-x-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#8B1E1E]" />
                        <span>BOM Quality Audit Criteria</span>
                      </Popover.Heading>
                      <Typography type="body-xs" className="text-stone-600 leading-relaxed">
                        {getStatusExplanation()}
                      </Typography>
                    </Popover.Dialog>
                  </Popover.Content>
                </Popover>
              </div>
              <Typography type="body-sm" className="mt-1 leading-relaxed opacity-90">
                {activeLine.remarks}
              </Typography>
            </div>
          </div>

          {/* Side by Side Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Planned Line Details */}
            <Card className="p-4 bg-stone-50/60 border border-stone-200 space-y-3">
              <Typography type="h5" className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Planned / MS SQL NAV-004 Values
              </Typography>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-stone-200/70">
                  <Typography type="body-sm" color="muted">Design Code:</Typography>
                  <Typography type="code" className="font-semibold text-stone-900 font-mono">
                    {activeLine.design || activeLine.designPrefix}
                  </Typography>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/70">
                  <Typography type="body-sm" color="muted">Yarn / Component Code:</Typography>
                  <Typography
                    type="code"
                    className={`font-semibold font-mono px-1.5 py-0.5 rounded ${
                      activeLine.status === "INVALID_CODE"
                        ? "bg-rose-200 text-rose-900 line-through"
                        : "text-stone-900"
                    }`}
                  >
                    {activeLine.componentCode || "(None)"}
                  </Typography>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/70">
                  <Typography type="body-sm" color="muted">Matching Code:</Typography>
                  <Typography type="code" className="font-mono font-medium text-stone-800">
                    {activeLine.matchingCode || "—"}
                  </Typography>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/70">
                  <Typography type="body-sm" color="muted">Planned Quantity:</Typography>
                  <Typography type="code" className="font-bold text-stone-900 font-mono">
                    {activeLine.plannedQty.toFixed(2)} KG
                  </Typography>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/70">
                  <Typography type="body-sm" color="muted">Rug Size & Shape:</Typography>
                  <Typography type="body-sm" className="font-semibold text-stone-800">
                    {activeLine.size || "—"} ({activeLine.shape || "—"})
                  </Typography>
                </div>
                <div className="flex justify-between py-1">
                  <Typography type="body-sm" color="muted">Ground / Border Colors:</Typography>
                  <Typography type="body-sm" className="font-medium text-stone-800 text-right">
                    GR: {activeLine.grColorCode || "—"} &bull; BR: {activeLine.brColorCode || "—"}
                  </Typography>
                </div>
              </div>
            </Card>

            {/* Benchmark Master Standards */}
            <Card className="p-4 bg-stone-50/60 border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <Typography type="h5" className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Benchmark Standards (Final Sheet)
                </Typography>

                {/* Hero UI Popover: Benchmark Info */}
                <Popover>
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    aria-label="Benchmark Policy"
                    className="w-5 h-5 p-0 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </Button>
                  <Popover.Content className="max-w-xs shadow-xl border border-stone-200 bg-white p-0 rounded-xl">
                    <Popover.Dialog className="p-4 space-y-1.5">
                      <Popover.Arrow />
                      <Popover.Heading className="text-xs font-bold text-stone-900 pb-1 border-b border-stone-100">
                        Design Code Benchmark Master
                      </Popover.Heading>
                      <Typography type="body-xs" className="text-stone-600 leading-relaxed">
                        Extracted from &ldquo;Copy of Design Code Data RND DND DRP.xlsx&rdquo; (Sheet: &ldquo;Final Sheet Data&rdquo;, Remark: &lsquo;Done&rsquo;).
                      </Typography>
                      <Typography type="body-xs" className="text-stone-500">
                        Up to 25 approved yarns per prefix are matched.
                      </Typography>
                    </Popover.Dialog>
                  </Popover.Content>
                </Popover>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-stone-200/70">
                  <Typography type="body-sm" color="muted">Design Prefix:</Typography>
                  <Typography type="code" className="font-bold text-[#8B1E1E] font-mono">
                    {activeLine.designPrefix}
                  </Typography>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/70">
                  <Typography type="body-sm" color="muted">Quality Spec:</Typography>
                  <Typography type="body-sm" className="font-medium text-stone-800">
                    {activeLine.quality || "—"}
                  </Typography>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/70">
                  <Typography type="body-sm" color="muted">Expected Average Qty:</Typography>
                  <Typography type="code" className="font-mono text-stone-800">
                    {activeLine.expectedQty > 0 ? `${activeLine.expectedQty.toFixed(2)} KG` : "N/A"}
                  </Typography>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-200/70">
                  <div className="flex items-center space-x-1">
                    <Typography type="body-sm" color="muted">Variance (Δ%):</Typography>
                    {/* Hero UI Popover: Variance Formula */}
                    <Popover>
                      <Button
                        variant="ghost"
                        size="sm"
                        isIconOnly
                        aria-label="Variance calculation"
                        className="w-4 h-4 p-0 text-stone-400 hover:text-stone-700 cursor-pointer"
                      >
                        <HelpCircle className="w-3 h-3" />
                      </Button>
                      <Popover.Content className="max-w-xs shadow-xl border border-stone-200 bg-white p-0 rounded-xl">
                        <Popover.Dialog className="p-4 space-y-1.5">
                          <Popover.Arrow />
                          <Popover.Heading className="text-xs font-bold text-stone-900 pb-1 border-b border-stone-100">
                            Variance Threshold Formula
                          </Popover.Heading>
                          <Typography type="body-xs" className="text-stone-600 leading-relaxed">
                            Variance = ((Planned - Expected) / Expected) &times; 100%.
                          </Typography>
                          <Typography type="body-xs" className="text-stone-500">
                            Planned transfer shortfall exceeding &minus;15% triggers a BELOW_AVG_QUANTITY discrepancy.
                          </Typography>
                        </Popover.Dialog>
                      </Popover.Content>
                    </Popover>
                  </div>
                  <Typography
                    type="code"
                    className={`font-mono font-bold ${
                      activeLine.variancePct < -15
                        ? "text-amber-700"
                        : activeLine.variancePct > 15
                        ? "text-blue-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {activeLine.variancePct}%
                  </Typography>
                </div>
                <div className="pt-1">
                  <Typography type="body-xs" color="muted" className="block mb-1.5">
                    Approved Yarn Codes for this Prefix:
                  </Typography>
                  <div className="flex flex-wrap gap-1">
                    {activeLine.approvedYarns.length > 0 ? (
                      activeLine.approvedYarns.map((yarn) => (
                        <Chip
                          key={yarn}
                          size="sm"
                          variant={yarn.toUpperCase() === activeLine.componentCode.toUpperCase() ? "primary" : "soft"}
                          color={yarn.toUpperCase() === activeLine.componentCode.toUpperCase() ? "success" : "default"}
                          className="font-mono font-bold text-[11px]"
                        >
                          {yarn}
                        </Chip>
                      ))
                    ) : (
                      <Typography type="body-xs" color="muted" className="italic">
                        No approved yarns registered
                      </Typography>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Proportional Quantity Checker (Transposed Size Comparison) */}
          <div className="pt-2 border-t border-stone-200">
            <ProportionalQuantityChecker line={activeLine} allLines={allLines} />
          </div>

          {/* Raw MS SQL Record Details with Hero UI Popover */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Typography type="h5" className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                All Available Fields in Record
              </Typography>

              {/* Hero UI Popover: ERP Source Details */}
              <Popover>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="ERP Source"
                  className="text-[11px] text-stone-500 flex items-center space-x-1 cursor-pointer h-6 px-2 hover:bg-stone-100 rounded-md"
                >
                  <Database className="w-3 h-3 text-stone-500" />
                  <span>NAV-004 Source</span>
                </Button>
                <Popover.Content className="max-w-xs shadow-xl border border-stone-200 bg-white p-0 rounded-xl">
                  <Popover.Dialog className="p-4 space-y-1.5">
                    <Popover.Arrow />
                    <Popover.Heading className="text-xs font-bold text-stone-900 pb-1 border-b border-stone-100 flex items-center space-x-1.5">
                      <Database className="w-3.5 h-3.5 text-stone-600" />
                      <span>ERP View Schema</span>
                    </Popover.Heading>
                    <Typography type="body-xs" className="text-stone-600 leading-relaxed">
                      59 columns retrieved live from hosted MS SQL Server (Database: JRCPL, View: [dbo].[NAV-004- Item wise BOM Details_FG-HN]).
                    </Typography>
                  </Popover.Dialog>
                </Popover.Content>
              </Popover>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50/50 p-3">
              <table className="w-full text-xs">
                <tbody>
                  {Object.entries(activeLine.rawRow).map(([key, val]) => (
                    <tr key={key} className="border-b border-stone-200/50 last:border-0">
                      <td className="py-1 text-stone-500 font-mono text-[11px] w-1/3">
                        <Typography type="code" className="text-[11px] text-stone-500 font-mono">
                          {key}
                        </Typography>
                      </td>
                      <td className="py-1 text-stone-800 font-medium font-mono text-[11px]">
                        <Typography type="code" className="text-[11px] text-stone-800 font-medium font-mono">
                          {val !== null && val !== undefined ? String(val) : "null"}
                        </Typography>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card.Content>

        {/* Footer */}
        <Card.Footer className="px-6 py-3.5 border-t border-stone-200 bg-stone-50/80 flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={onClose}
            className="cursor-pointer bg-stone-900 text-white hover:bg-stone-800"
          >
            Close Diagnosis
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
};
