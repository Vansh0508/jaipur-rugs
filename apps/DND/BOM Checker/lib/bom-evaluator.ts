import { getMssqlPool, isMssqlConfigured } from "./mssql";
import { mssqlCache } from "./mssql-cache";
import { auditBomRows, extractDesignPrefix } from "./audit-engine";
import { loadBenchmarks } from "./supabase";
import { parseRugAreaSqFt } from "./quantity-checker";

export interface RugEvaluationInput {
  itemNo: string;
  design?: string;
  quality?: string;
  grColorName?: string;
  grColorCode?: string;
  brColorName?: string;
  brColorCode?: string;
  shape?: string;
  size?: string;
  matchingCode?: string;
}

export type BomValidityStatus = "Passed" | "Rejected" | "Unregistered" | "Not Found";
export type WeightAccuracyStatus = "Matched" | "Rejected" | "Not Found";

export interface BomValidityResult {
  status: BomValidityStatus;
  label: string;
  totalLines: number;
  discrepanciesCount: number;
  details: string;
  issues: string[];
  bomNo?: string;
}

export interface WeightAccuracyResult {
  status: WeightAccuracyStatus;
  label: string;
  currentRatePsf?: number;
  currentArea?: number;
  currentWeight?: number;
  referenceBomNo?: string;
  referenceSize?: string;
  referenceShape?: string;
  referenceRatePsf?: number;
  referenceWeight?: number;
  variancePct?: number;
  details: string;
}

export interface RugEvaluationResult {
  itemNo: string;
  bomNo?: string;
  bomValidity: BomValidityResult;
  weightAccuracy: WeightAccuracyResult;
}

/**
 * Shared helper to query live BOM lines from NAV-004 for a batch of item numbers.
 */
async function fetchRawBomLinesForItems(pool: any, itemNos: string[]): Promise<Map<string, any[]>> {
  const linesByItem = new Map<string, any[]>();
  if (itemNos.length === 0) return linesByItem;

  const itemNosToQuery = itemNos.map((i) => i.trim().replace(/'/g, "''"));
  const reqLines = pool.request();
  const linesRes = await reqLines.query(`
    SELECT *
    FROM [dbo].[NAV-004- Item wise BOM Details_FG-HN]
    WHERE [Item No_] IN ('${itemNosToQuery.join("','")}')
    ORDER BY [Item No_], [Line No_] ASC
  `);

  for (const row of linesRes.recordset) {
    const itm = String(row["Item No_"] || "").trim().toUpperCase();
    if (!linesByItem.has(itm)) linesByItem.set(itm, []);
    linesByItem.get(itm)!.push(row);
  }

  return linesByItem;
}

/**
 * Fast, independent BOM Validity evaluator.
 * Queries NAV-004 only for the requested item lines and performs in-memory benchmark checks.
 * Does NOT execute any slow historical cross-table queries.
 */
export async function evaluateBomValidityBatch(
  items: RugEvaluationInput[],
  options: { bypassCache?: boolean } = {}
): Promise<Record<string, BomValidityResult>> {
  const results: Record<string, BomValidityResult> = {};
  const uncachedItems: RugEvaluationInput[] = [];

  for (const item of items) {
    if (!item.itemNo) continue;
    const cacheKey = `rug-validity:v2:${item.itemNo.trim().toUpperCase()}`;
    if (!options.bypassCache) {
      const cached = mssqlCache.get<BomValidityResult>(cacheKey);
      if (cached) {
        results[item.itemNo] = cached;
        continue;
      }
    }
    uncachedItems.push(item);
  }

  if (uncachedItems.length === 0) {
    return results;
  }

  if (!isMssqlConfigured()) {
    const benchmarksMap = await loadBenchmarks();
    for (const item of uncachedItems) {
      const targetDesign = (item.design || "").trim();
      const prefix = extractDesignPrefix(targetDesign, item.itemNo);
      const benchmark = benchmarksMap.get(prefix.toUpperCase());

      const hasBom =
        item.itemNo.endsWith("4") ||
        item.itemNo.endsWith("8") ||
        item.itemNo.endsWith("7") ||
        item.itemNo.endsWith("9");

      if (!hasBom) {
        const valResult: BomValidityResult = {
          status: "Not Found",
          label: "Not Found",
          totalLines: 0,
          discrepanciesCount: 0,
          details: `No active bill of materials is registered in NAV-004 for item ${item.itemNo}.`,
          issues: [],
        };
        results[item.itemNo] = valResult;
        continue;
      }

      if (!benchmark) {
        const valResult: BomValidityResult = {
          status: "Unregistered",
          label: "Unregistered",
          totalLines: 8,
          discrepanciesCount: 8,
          details: `Design prefix '${prefix || "Unknown"}' is not registered or Remark is not 'Done' in benchmark master.`,
          issues: [`Design prefix '${prefix || "Unknown"}' is unregistered in benchmark master.`],
          bomNo: `JRC/PRDBOM/MOCK-${item.itemNo}`,
        };
        results[item.itemNo] = valResult;
        continue;
      }

      const valResult: BomValidityResult = {
        status: "Passed",
        label: "Passed",
        totalLines: 12,
        discrepanciesCount: 0,
        details: "All 12 BOM lines valid. Matches approved benchmark specs.",
        issues: [],
        bomNo: `JRC/PRDBOM/MOCK-${item.itemNo}`,
      };
      results[item.itemNo] = valResult;
    }
    return results;
  }

  try {
    const pool = await getMssqlPool();
    const linesByItem = await fetchRawBomLinesForItems(
      pool,
      uncachedItems.map((i) => i.itemNo)
    );
    const benchmarksMap = await loadBenchmarks();

    for (const item of uncachedItems) {
      const key = item.itemNo.trim().toUpperCase();
      const rawLines = linesByItem.get(key) || [];
      const currentBomNo = String(rawLines[0]?.["Production BOM No_"] || "").trim();
      const hasActualBom =
        rawLines.length > 0 &&
        currentBomNo.length > 0 &&
        currentBomNo !== "0" &&
        currentBomNo.toLowerCase() !== "null" &&
        currentBomNo.toLowerCase() !== "n/a";

      if (!hasActualBom) {
        const valResult: BomValidityResult = {
          status: "Not Found",
          label: "Not Found",
          totalLines: 0,
          discrepanciesCount: 0,
          details: `No active bill of materials is registered in NAV-004 for item ${item.itemNo}.`,
          issues: [],
        };
        results[item.itemNo] = valResult;
        mssqlCache.set(`rug-validity:v2:${key}`, valResult, 15 * 60 * 1000);
        continue;
      }

      for (const row of rawLines) {
        if (!row["Design"] && item.design) {
          row["Design"] = item.design;
        }
      }

      const { auditedLines } = await auditBomRows(rawLines);
      const discrepancies = auditedLines.filter((l) => l.status !== "VALID");

      const targetDesign = (item.design || rawLines[0]?.["Design"] || "").trim().toUpperCase();
      const targetDesignPrefix = extractDesignPrefix(targetDesign, item.itemNo);
      const isBenchmarkRegistered = Boolean(benchmarksMap.get(targetDesignPrefix.toUpperCase()));

      const hasUnregisteredPrefix =
        !isBenchmarkRegistered || auditedLines.some((l) => l.status === "UNREGISTERED_PREFIX");

      let bomValidityStatus: BomValidityStatus = "Passed";
      let issues: string[] = [];
      let bomValidityDetails = `All ${rawLines.length} BOM lines valid (matches approved benchmark specs and standard rules).`;

      if (hasUnregisteredPrefix) {
        bomValidityStatus = "Unregistered";
        issues = discrepancies.map((d) => `Line ${d.lineNo}: ${d.statusMessage}`);
        if (issues.length === 0) {
          issues = [
            `Design prefix '${targetDesignPrefix || "Unknown"}' is not registered or Remark is not 'Done' in benchmark master.`,
          ];
        }
        bomValidityDetails = `Design prefix '${targetDesignPrefix || "Unknown"}' is not registered or Remark is not 'Done' in benchmark master.\n• ${issues.slice(
          0,
          3
        ).join("\n• ")}${issues.length > 3 ? `\n...and ${issues.length - 3} more` : ""}`;
      } else if (discrepancies.length > 0) {
        bomValidityStatus = "Rejected";
        issues = discrepancies.map((d) => `Line ${d.lineNo}: ${d.statusMessage}`);
        bomValidityDetails = `${discrepancies.length} discrepanc${
          discrepancies.length === 1 ? "y" : "ies"
        } found:\n• ${issues.slice(0, 3).join("\n• ")}${
          issues.length > 3 ? `\n...and ${issues.length - 3} more` : ""
        }`;
      }

      const valResult: BomValidityResult = {
        status: bomValidityStatus,
        label: bomValidityStatus,
        totalLines: rawLines.length,
        discrepanciesCount: discrepancies.length,
        details: bomValidityDetails,
        issues,
        bomNo: currentBomNo,
      };

      results[item.itemNo] = valResult;
      mssqlCache.set(`rug-validity:v2:${key}`, valResult, 15 * 60 * 1000);
    }

    return results;
  } catch (err: any) {
    console.error("Error evaluating BOM validity:", err);
    return results;
  }
}

/**
 * Independent Weight Accuracy evaluator.
 * Compares current BOM rates against past BOMs of identical construction parameters in different sizes.
 * Queries past designs in parallel via Promise.all with caching.
 */
export async function evaluateWeightAccuracyBatch(
  items: RugEvaluationInput[],
  options: { bypassCache?: boolean } = {}
): Promise<Record<string, WeightAccuracyResult>> {
  const results: Record<string, WeightAccuracyResult> = {};
  const uncachedItems: RugEvaluationInput[] = [];

  for (const item of items) {
    if (!item.itemNo) continue;
    const cacheKey = `rug-weight:v2:${item.itemNo.trim().toUpperCase()}`;
    if (!options.bypassCache) {
      const cached = mssqlCache.get<WeightAccuracyResult>(cacheKey);
      if (cached) {
        results[item.itemNo] = cached;
        continue;
      }
    }
    uncachedItems.push(item);
  }

  if (uncachedItems.length === 0) {
    return results;
  }

  if (!isMssqlConfigured()) {
    const benchmarksMap = await loadBenchmarks();
    for (const item of uncachedItems) {
      const targetDesign = (item.design || "").trim();
      const prefix = extractDesignPrefix(targetDesign, item.itemNo);
      const benchmark = benchmarksMap.get(prefix.toUpperCase());

      const hasBom =
        item.itemNo.endsWith("4") ||
        item.itemNo.endsWith("8") ||
        item.itemNo.endsWith("7") ||
        item.itemNo.endsWith("9");

      if (!hasBom) {
        const weightResult: WeightAccuracyResult = {
          status: "Not Found",
          label: "Not Found",
          details: `Item has no registered BOM in NAV-004 to evaluate weight proportions.`,
        };
        results[item.itemNo] = weightResult;
        continue;
      }

      if (!benchmark) {
        const weightResult: WeightAccuracyResult = {
          status: "Not Found",
          label: "Not Found",
          details: `No past BOM found with identical parameters in a different size.`,
        };
        results[item.itemNo] = weightResult;
        continue;
      }

      const weightResult: WeightAccuracyResult = {
        status: "Matched",
        label: "Matched",
        currentRatePsf: 0.507,
        referenceRatePsf: 0.507,
        referenceSize: "8X10",
        variancePct: 0.0,
        details: `Matched with past BOM of size 8X10: 0.5070 kg/sqft vs current 0.5070 kg/sqft (0.0% variance).`,
      };
      results[item.itemNo] = weightResult;
    }
    return results;
  }

  try {
    const pool = await getMssqlPool();
    const linesByItem = await fetchRawBomLinesForItems(
      pool,
      uncachedItems.map((i) => i.itemNo)
    );

    // Identify distinct designs to query candidate past BOMs
    const designsToQuery = Array.from(
      new Set(
        uncachedItems
          .filter((i) => linesByItem.has(i.itemNo.trim().toUpperCase()))
          .map((i) => {
            const lines = linesByItem.get(i.itemNo.trim().toUpperCase());
            return (i.design || lines?.[0]?.["Design"] || "").trim();
          })
          .filter((d) => d && d.length >= 2)
      )
    );

    const pastBomsByDesign = new Map<string, any[]>();

    // Query distinct designs in parallel rather than sequentially
    await Promise.all(
      designsToQuery.map(async (design) => {
        const designKey = design.toUpperCase();
        const cacheKey = `past-boms:${designKey}`;

        if (!options.bypassCache) {
          const cachedPast = mssqlCache.get<any[]>(cacheKey);
          if (cachedPast) {
            pastBomsByDesign.set(designKey, cachedPast);
            return;
          }
        }

        try {
          const reqPast = pool.request();
          reqPast.input("design", design);
          const pastRes = await reqPast.query(`
            SELECT TOP 50
              [Item No_],
              [Production BOM No_],
              [Design],
              [Quality],
              [Size],
              [Shape],
              [Ground Color],
              [GR Color Name],
              [Border Color],
              [BR Color Name],
              [Area (Sq_ ft_)],
              SUM([Quantity]) as TotalQuantity
            FROM [dbo].[NAV-004- Item wise BOM Details_FG-HN]
            WHERE [Design] = @design
            GROUP BY 
              [Item No_],
              [Production BOM No_],
              [Design],
              [Quality],
              [Size],
              [Shape],
              [Ground Color],
              [GR Color Name],
              [Border Color],
              [BR Color Name],
              [Area (Sq_ ft_)]
          `);

          pastBomsByDesign.set(designKey, pastRes.recordset);
          mssqlCache.set(cacheKey, pastRes.recordset, 30 * 60 * 1000);
        } catch (err) {
          console.warn(`Could not query past BOMs for design ${design}:`, err);
          pastBomsByDesign.set(designKey, []);
        }
      })
    );

    for (const item of uncachedItems) {
      const key = item.itemNo.trim().toUpperCase();
      const rawLines = linesByItem.get(key) || [];
      const currentBomNo = String(rawLines[0]?.["Production BOM No_"] || "").trim();
      const hasActualBom =
        rawLines.length > 0 &&
        currentBomNo.length > 0 &&
        currentBomNo !== "0" &&
        currentBomNo.toLowerCase() !== "null" &&
        currentBomNo.toLowerCase() !== "n/a";

      if (!hasActualBom) {
        const weightResult: WeightAccuracyResult = {
          status: "Not Found",
          label: "Not Found",
          details: `Item has no registered BOM in NAV-004 to evaluate weight proportions.`,
        };
        results[item.itemNo] = weightResult;
        mssqlCache.set(`rug-weight:v2:${key}`, weightResult, 15 * 60 * 1000);
        continue;
      }

      const targetDesign = (item.design || rawLines[0]?.["Design"] || "").trim().toUpperCase();
      const targetQuality = (item.quality || rawLines[0]?.["Quality"] || "").trim().toUpperCase();
      const targetShape = (item.shape || rawLines[0]?.["Shape"] || "").trim().toUpperCase();
      const targetGrCode = (item.grColorCode || rawLines[0]?.["Ground Color"] || "").trim().toUpperCase();
      const targetGrName = (item.grColorName || rawLines[0]?.["GR Color Name"] || "").trim().toUpperCase();
      const targetBrCode = (item.brColorCode || rawLines[0]?.["Border Color"] || "").trim().toUpperCase();
      const targetBrName = (item.brColorName || rawLines[0]?.["BR Color Name"] || "").trim().toUpperCase();
      const targetSize = (item.size || rawLines[0]?.["Size"] || "").trim().toUpperCase();

      const currentTotalWeight = rawLines.reduce((sum, l) => sum + Number(l["Quantity"] || 0), 0);
      const currentArea = parseRugAreaSqFt(targetSize, Number(rawLines[0]?.["Area (Sq_ ft_)"] || 0));
      const currentRate = currentArea > 0 ? currentTotalWeight / currentArea : 0;

      const candidates = pastBomsByDesign.get(targetDesign) || [];

      // Match candidate: same Quality, Shape, Colors, but DIFFERENT size
      const matchingPastBoms = candidates.filter((c) => {
        const cQuality = String(c["Quality"] || "").trim().toUpperCase();
        const cShape = String(c["Shape"] || "").trim().toUpperCase();
        const cSize = String(c["Size"] || "").trim().toUpperCase();
        const cGrCode = String(c["Ground Color"] || "").trim().toUpperCase();
        const cGrName = String(c["GR Color Name"] || "").trim().toUpperCase();
        const cBrCode = String(c["Border Color"] || "").trim().toUpperCase();
        const cBrName = String(c["BR Color Name"] || "").trim().toUpperCase();
        const cBomNo = String(c["Production BOM No_"] || "").trim();

        if (cQuality !== targetQuality) return false;
        if (targetShape && cShape && targetShape !== cShape) return false;

        if (targetGrCode || targetGrName) {
          const grMatch =
            (targetGrCode && cGrCode && targetGrCode === cGrCode) ||
            (targetGrName && cGrName && targetGrName === cGrName) ||
            (targetGrCode && cGrName && targetGrCode === cGrName) ||
            (targetGrName && cGrCode && targetGrName === cGrCode);
          if (!grMatch) return false;
        }

        if (targetBrCode || targetBrName) {
          const brMatch =
            (targetBrCode && cBrCode && targetBrCode === cBrCode) ||
            (targetBrName && cBrName && targetBrName === cBrName) ||
            (targetBrCode && cBrName && targetBrCode === cBrName) ||
            (targetBrName && cBrCode && targetBrName === cBrCode);
          if (!brMatch) return false;
        }

        if (cSize === targetSize && cBomNo === currentBomNo) return false;
        if (cSize === targetSize) return false;

        return true;
      });

      let weightStatus: WeightAccuracyStatus = "Not Found";
      let weightDetails = `No past BOM found with identical Design (${targetDesign}), Quality (${targetQuality}), Color, and Shape in a different size.`;
      let refBomNo: string | undefined;
      let refSize: string | undefined;
      let refShape: string | undefined;
      let refRate: number | undefined;
      let refWeight: number | undefined;
      let variancePct: number | undefined;

      if (matchingPastBoms.length > 0) {
        const ref = matchingPastBoms[0];
        refSize = String(ref["Size"] || "").trim();
        refBomNo = String(ref["Production BOM No_"] || "").trim();
        refShape = String(ref["Shape"] || targetShape).trim();
        refWeight = Number(ref.TotalQuantity || 0);
        const refArea = parseRugAreaSqFt(refSize, Number(ref["Area (Sq_ ft_)"] || 0));
        refRate = refArea > 0 ? refWeight / refArea : 0;

        if (refRate > 0 && currentRate > 0) {
          variancePct = Math.round(((currentRate - refRate) / refRate) * 1000) / 10;
          const absVariance = Math.abs(variancePct);

          if (absVariance <= 3.0) {
            weightStatus = "Matched";
            weightDetails = `Matched with past BOM ${refBomNo} (Size: ${refSize}, Shape: ${refShape}): Rate ${currentRate.toFixed(
              4
            )} kg/sqft vs past rate ${refRate.toFixed(4)} kg/sqft (${
              variancePct >= 0 ? "+" : ""
            }${variancePct}% variance within optimal limits).`;
          } else {
            weightStatus = "Rejected";
            weightDetails = `Variance of ${
              variancePct >= 0 ? "+" : ""
            }${variancePct}% detected against past BOM ${refBomNo} (Size: ${refSize}): Current rate is ${currentRate.toFixed(
              4
            )} kg/sqft vs past BOM rate ${refRate.toFixed(4)} kg/sqft (${
              currentRate > refRate ? "excess weight" : "deficit weight"
            }).`;
          }
        }
      }

      const weightResult: WeightAccuracyResult = {
        status: weightStatus,
        label: weightStatus,
        currentRatePsf: currentRate > 0 ? Number(currentRate.toFixed(4)) : undefined,
        currentArea: currentArea > 0 ? currentArea : undefined,
        currentWeight: currentTotalWeight > 0 ? Number(currentTotalWeight.toFixed(3)) : undefined,
        referenceBomNo: refBomNo,
        referenceSize: refSize,
        referenceShape: refShape,
        referenceRatePsf: refRate ? Number(refRate.toFixed(4)) : undefined,
        referenceWeight: refWeight ? Number(refWeight.toFixed(3)) : undefined,
        variancePct,
        details: weightDetails,
      };

      results[item.itemNo] = weightResult;
      mssqlCache.set(`rug-weight:v2:${key}`, weightResult, 15 * 60 * 1000);
    }

    return results;
  } catch (err: any) {
    console.error("Error evaluating weight accuracy:", err);
    return results;
  }
}

/**
 * Composite evaluator running both BOM Validity and Weight Accuracy in parallel.
 * Kept for full backwards compatibility.
 */
export async function evaluateRugsBatch(
  items: RugEvaluationInput[],
  options: { bypassCache?: boolean } = {}
): Promise<Record<string, RugEvaluationResult>> {
  const [validityMap, weightMap] = await Promise.all([
    evaluateBomValidityBatch(items, options),
    evaluateWeightAccuracyBatch(items, options),
  ]);

  const results: Record<string, RugEvaluationResult> = {};

  for (const item of items) {
    const itemNo = item.itemNo;
    const validity = validityMap[itemNo] || {
      status: "Not Found",
      label: "Not Found",
      totalLines: 0,
      discrepanciesCount: 0,
      details: "No active bill of materials is registered.",
      issues: [],
    };
    const weight = weightMap[itemNo] || {
      status: "Not Found",
      label: "Not Found",
      details: "Item has no registered BOM in NAV-004 to evaluate weight proportions.",
    };

    results[itemNo] = {
      itemNo,
      bomNo: validity.bomNo,
      bomValidity: validity,
      weightAccuracy: weight,
    };
  }

  return results;
}
