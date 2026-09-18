import { DesignBenchmark, loadBenchmarks } from "./supabase";

export type AuditStatus = "VALID" | "INVALID_CODE" | "BELOW_AVG_QUANTITY" | "UNREGISTERED_PREFIX";

export interface AuditedBomLine {
  id: string;
  bomNo: string;
  itemNo: string;
  matchingCode: string;
  quality: string;
  design: string;
  designPrefix: string;
  grColorCode: string;
  grColorName: string;
  brColorCode: string;
  brColorName: string;
  size: string;
  shape: string;
  error: string;
  remarks: string;

  // Aliases and Detail fields
  creationDate?: string;
  lastDateModified?: string;
  designCode?: string;
  rugSize?: string;
  areaSqFt?: number;
  documentNo: string;
  lineNo: number;
  componentCode: string;
  componentDescription: string;
  unitOfMeasure: string;
  plannedQty: number;
  expectedQty: number;
  standardPsf: number;
  variancePct: number;
  status: AuditStatus;
  statusMessage: string;
  approvedYarns: string[];
  rawRow: Record<string, any>;
}

export interface AuditSummary {
  totalLines: number;
  validCount: number;
  invalidCodeCount: number;
  belowAvgQtyCount: number;
  unregisteredPrefixCount: number;
  discrepancyRate: number;
}

/**
 * Standard yarn codes considered approved/OK across all designs per D&D rules:
 * Strictly exact match only: "TH", "TN", "TC", "LC" (no prefixes or suffixes permitted).
 */
export const PERMITTED_STANDARD_YARN_CODES = new Set(["TH", "TN", "TC", "LC"]);

export function isPermittedStandardYarnCode(code?: string): boolean {
  if (!code) return false;
  const clean = code.trim().toUpperCase();
  return PERMITTED_STANDARD_YARN_CODES.has(clean);
}

/**
 * Extract design prefix from Design (e.g. "SPR-05" -> "SPR", "HPBS-7001" -> "HPBS")
 */
export function extractDesignPrefix(designCode?: string, itemNo?: string): string {
  const code = (designCode || itemNo || "").trim().toUpperCase();
  const match = code.match(/^([A-Z0-9]+)[-_]/);
  if (match) return match[1];
  return code.split(/[-_\s]/)[0] || "";
}

/**
 * Audit live MS SQL rows against benchmark standards
 */
export async function auditBomRows(rawRows: Record<string, any>[]): Promise<{
  auditedLines: AuditedBomLine[];
  summary: AuditSummary;
}> {
  const benchmarksMap = await loadBenchmarks();
  const auditedLines: AuditedBomLine[] = [];

  let validCount = 0;
  let invalidCodeCount = 0;
  let belowAvgQtyCount = 0;
  let unregisteredPrefixCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    const bomNo = String(row["Production BOM No_"] || row["Production BOM No"] || row["Document No_"] || `BOM-${i + 1}`).trim();
    const itemNo = String(row["Item No_"] || row["Item No"] || "").trim();
    const matchingCode = String(row["Matching Code"] || row["MatchingCode"] || "").trim();
    const quality = String(row["Quality"] || "").trim();
    const design = String(row["Design"] || "").trim();
    const grColorCode = String(row["Ground Color"] || row["Color Code"] || "").trim();
    const grColorName = String(row["GR Color Name"] || "").trim();
    const brColorCode = String(row["Border Color"] || "").trim();
    const brColorName = String(row["BR Color Name"] || "").trim();
    const size = String(row["Size"] || row["Map Size"] || "").trim();
    const shape = String(row["Shape"] || "").trim();

    const lineNo = Number(row["Line No_"] || (i + 1) * 10000);
    const yarnCode = String(row["Yarn Code"] || "").trim();
    const lineItem = String(row["Line Item"] || "").trim();
    const componentCode = yarnCode || lineItem;

    const componentDesc = String(row["Line Item Description"] || row["JOB Card Description"] || "");
    const plannedQty = Number(row["Quantity"] || row["Quantity per"] || 0);
    const expectedQty = Number(row["Standard Qty"] || 0);
    const standardPsf = Number(row["Standard PSF"] || 0);

    let variancePct = 0;
    if (expectedQty > 0) {
      variancePct = Math.round(((plannedQty - expectedQty) / expectedQty) * 1000) / 10;
    }

    const designPrefix = extractDesignPrefix(design, itemNo);
    const benchmark = benchmarksMap.get(designPrefix);

    let status: AuditStatus = "VALID";
    let statusMessage = "Valid BOM line (Matches approved benchmark specs)";
    let errorText = "None";

    // Strictly check for exact TN, TH, TC, or LC with no prefixes/suffixes
    const isStandardYarnExempt =
      isPermittedStandardYarnCode(componentCode) || isPermittedStandardYarnCode(yarnCode);

    if (!benchmark) {
      status = "UNREGISTERED_PREFIX";
      errorText = "Unregistered Prefix";
      statusMessage = `Design prefix '${designPrefix}' is not registered or Remark is not 'Done' in benchmark master.`;
      unregisteredPrefixCount++;
    } else {
      const approvedCodes = benchmark.approved_yarn_codes || [];
      const isApproved =
        isStandardYarnExempt ||
        approvedCodes.some((c) => c.toUpperCase() === componentCode.toUpperCase());

      if (!isApproved && componentCode !== "") {
        status = "INVALID_CODE";
        errorText = `Invalid Yarn Code (${componentCode})`;
        statusMessage = `Yarn Code '${componentCode}' is NOT approved for design prefix '${designPrefix}'. Approved: [${approvedCodes.join(", ")}]`;
        invalidCodeCount++;
      } else if (expectedQty > 0 && variancePct < -15.0) {
        status = "BELOW_AVG_QUANTITY";
        errorText = `Below Avg Qty (${Math.abs(variancePct)}%)`;
        statusMessage = `Planned quantity (${plannedQty.toFixed(2)} KG) is ${Math.abs(variancePct)}% below standard average (${expectedQty.toFixed(2)} KG) for size ${size}.`;
        belowAvgQtyCount++;
      } else {
        validCount++;
        if (isStandardYarnExempt && !approvedCodes.some((c) => c.toUpperCase() === componentCode.toUpperCase())) {
          statusMessage = `Valid BOM line (Yarn code '${componentCode}' is approved via standard TH/TN/TC/LC rule)`;
        }
      }
    }

    auditedLines.push({
      id: `${itemNo}-${lineNo}-${i}`,
      bomNo,
      itemNo,
      matchingCode,
      quality,
      design,
      designPrefix,
      grColorCode,
      grColorName,
      brColorCode,
      brColorName,
      size,
      shape,
      error: errorText,
      remarks: statusMessage,

      // Detail fields and aliases
      creationDate: row["BOM Creation Date"] ? String(row["BOM Creation Date"]) : undefined,
      lastDateModified: row["Last Date Modified"] ? String(row["Last Date Modified"]) : undefined,
      designCode: design,
      rugSize: size,
      areaSqFt: Number(row["Area (Sq_ ft_)"] || row["Std. Sq. Ft."] || 0),
      documentNo: bomNo,
      lineNo,
      componentCode,
      componentDescription: componentDesc,
      unitOfMeasure: "KG",
      plannedQty,
      expectedQty,
      standardPsf,
      variancePct,
      status,
      statusMessage,
      approvedYarns: benchmark?.approved_yarn_codes || [],
      rawRow: row,
    });
  }

  const totalLines = auditedLines.length;
  const discrepancies = invalidCodeCount + belowAvgQtyCount + unregisteredPrefixCount;
  const discrepancyRate = totalLines > 0 ? Math.round((discrepancies / totalLines) * 1000) / 10 : 0;

  return {
    auditedLines,
    summary: {
      totalLines,
      validCount,
      invalidCodeCount,
      belowAvgQtyCount,
      unregisteredPrefixCount,
      discrepancyRate,
    },
  };
}
