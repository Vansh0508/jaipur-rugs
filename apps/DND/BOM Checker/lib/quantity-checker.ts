/**
 * Proportional Quantity Checker Engine
 * Compares material consumption across different sizes (and same-size matches)
 * for items with matching Design Code, Quality, Ground Color (GR), and Border Color (BR).
 */

export interface ProportionalSizeColumn {
  id: string;
  size: string;
  areaSqFt: number;
  bomNo: string;
  itemNo: string;
  isCurrentBom: boolean;
  isSameSize: boolean;
  yarnCode: string;
  yarnDescription: string;
  allocatedWeight: number; // KG
  consumptionRatePsf: number; // KG / Sq. Ft.
  expectedWeightForCurrentSize: number; // KG derived from this reference's rate
  deltaWeight: number; // Current Allocated - Expected Weight
  deltaPct: number; // ((Current Allocated - Expected) / Expected) * 100
  verdict: "DEFICIT" | "EXCESS" | "OPTIMAL";
  verdictText: string;
  statusColor: "danger" | "warning" | "success" | "accent" | "default";
}

export interface ProportionalComparisonRow {
  id: string;
  design: string;
  grColorName: string;
  grColorCode: string;
  brColorName: string;
  brColorCode: string;
  colorCode: string;
  size: string;
  areaSqFt: number;
  quantity: number; // Allocated weight for this row (KG)
  consumptionRatePsf: number;
  compareSize: string; // Target size (e.g. 8X10)
  compareAreaSqFt: number;
  expectedQuantity: number; // Expected weight for target size derived from this row
  deltaWeight: number; // Target Allocated - Expected
  deltaPct: number;
  status: "MORE_MATERIAL_NEEDED" | "DECREASE_MATERIAL" | "OPTIMAL" | "BASELINE";
  statusText: string;
  statusColor: "warning" | "danger" | "success" | "default";
  isCurrentBom: boolean;
  isSameSize: boolean;
  bomNo: string;
  itemNo: string;
  yarnCode: string;
}

export interface QuantityCheckerResult {
  design: string;
  quality: string;
  grColor: string;
  brColor: string;
  yarnCode?: string;
  yarnDescription?: string;
  currentTarget: {
    bomNo: string;
    itemNo: string;
    size: string;
    areaSqFt: number;
    allocatedWeight: number;
    consumptionRatePsf: number;
  };
  referenceColumns: ProportionalSizeColumn[];
  comparisonRows: ProportionalComparisonRow[];
  benchmarkRatePsf: number;
  benchmarkExpectedWeight: number;
  benchmarkDeltaWeight: number;
  benchmarkDeltaPct: number;
  benchmarkVerdict: "DEFICIT" | "EXCESS" | "OPTIMAL";
  benchmarkVerdictText: string;
  hasSameSizeMatches: boolean;
  hasDifferentSizeMatches: boolean;
  totalMatchesCount: number;
  distinctSizesCount: number;
}

/**
 * Standard rug area calculations (sq. ft.) for common standard sizes in carpet/rug manufacturing
 */
const STANDARD_RUG_AREAS: Record<string, number> = {
  "2X3": 6.0,
  "3X5": 15.0,
  "4X6": 24.0,
  "5X8": 40.0,
  "6X9": 54.0,
  "8X10": 80.0,
  "8X11": 88.0,
  "9X12": 103.79, // Standard catalog industry conversion for 9x12 Hand knotted
  "10X14": 140.0,
  "12X15": 180.0,
  "10X10": 100.0,
  "8X8": 64.0,
  "6X6": 36.0,
};

/**
 * Parse rug dimensions string into square footage.
 * Prioritizes rawArea from MS SQL if provided and valid.
 * Supports feet and inches notation like 5'6X8'6 (5.5 * 8.5 = 46.75 sq.ft.)
 */
export function parseRugAreaSqFt(sizeStr?: string, rawArea?: number | null): number {
  if (typeof rawArea === "number" && rawArea > 0) {
    return Math.round(rawArea * 100) / 100;
  }

  if (!sizeStr) return 0;
  const cleaned = sizeStr.trim().toUpperCase().replace(/\s+/g, "");

  // Check known standard area map
  if (STANDARD_RUG_AREAS[cleaned]) {
    return STANDARD_RUG_AREAS[cleaned];
  }

  // Parse dimension patterns: e.g., 5'6X8'6, 8X10, 8'0"X10'0", 2.5X8
  const parts = cleaned.split(/X|\*|BY/);
  if (parts.length === 2) {
    const parseDim = (dim: string): number => {
      // Check feet'inches pattern: 5'6 or 5'6"
      const ftInMatch = dim.match(/^(\d+)(?:'|FT)?(?:(\d+)(?:"|IN)?)?$/);
      if (ftInMatch) {
        const ft = parseFloat(ftInMatch[1]);
        const inches = ftInMatch[2] ? parseFloat(ftInMatch[2]) : 0;
        return ft + inches / 12;
      }
      const num = parseFloat(dim.replace(/['"FTIN]/g, ""));
      return isNaN(num) ? 0 : num;
    };

    const d1 = parseDim(parts[0]);
    const d2 = parseDim(parts[1]);
    if (d1 > 0 && d2 > 0) {
      return Math.round(d1 * d2 * 100) / 100;
    }
  }

  return 0;
}

/**
 * Compute the proportional weight analysis given a target line and a set of candidate matching rows.
 */
export function computeQuantityChecker(
  targetLine: {
    bomNo: string;
    itemNo: string;
    design: string;
    quality: string;
    grColorCode?: string;
    grColorName?: string;
    brColorCode?: string;
    brColorName?: string;
    size: string;
    areaSqFt?: number;
    componentCode?: string;
    componentDescription?: string;
    plannedQty: number;
    rawRow?: Record<string, any>;
  },
  candidateRows: Array<{
    bomNo?: string;
    itemNo?: string;
    design?: string;
    quality?: string;
    grColorCode?: string;
    grColorName?: string;
    brColorCode?: string;
    brColorName?: string;
    size?: string;
    areaSqFt?: number;
    componentCode?: string;
    componentDescription?: string;
    plannedQty?: number;
    standardPsf?: number;
    rawRow?: Record<string, any>;
  }>
): QuantityCheckerResult {
  const targetArea = parseRugAreaSqFt(
    targetLine.size,
    targetLine.areaSqFt || targetLine.rawRow?.["Area (Sq_ ft_)"]
  );

  const targetAllocated = targetLine.plannedQty || 0;
  const targetRatePsf = targetArea > 0 ? targetAllocated / targetArea : 0;

  const targetGr = (targetLine.grColorCode || targetLine.grColorName || "").trim().toUpperCase();
  const targetBr = (targetLine.brColorCode || targetLine.brColorName || "").trim().toUpperCase();
  const targetDesign = (targetLine.design || "").trim().toUpperCase();
  const targetQuality = (targetLine.quality || "").trim().toUpperCase();
  const targetYarn = (targetLine.componentCode || "").trim().toUpperCase();

  // Filter candidates matching same Design, Quality, GR, BR (and Yarn Code if specific component)
  const matchingCandidates = candidateRows.filter((c) => {
    const d = (c.design || c.rawRow?.["Design"] || "").trim().toUpperCase();
    const q = (c.quality || c.rawRow?.["Quality"] || "").trim().toUpperCase();
    const gr = (c.grColorCode || c.grColorName || c.rawRow?.["Ground Color"] || c.rawRow?.["Ground Color Description"] || "").trim().toUpperCase();
    const br = (c.brColorCode || c.brColorName || c.rawRow?.["Border Color"] || c.rawRow?.["Border Color Description"] || "").trim().toUpperCase();
    const y = (c.componentCode || c.rawRow?.["Yarn Code"] || "").trim().toUpperCase();

    // Design & Quality match
    if (d !== targetDesign && !d.startsWith(targetDesign) && !targetDesign.startsWith(d)) {
      return false;
    }
    if (q !== targetQuality) {
      return false;
    }

    // GR & BR match if specified
    if (targetGr && gr && targetGr !== gr) return false;
    if (targetBr && br && targetBr !== br) return false;

    // Component Yarn match if available
    if (targetYarn && y && targetYarn !== y) return false;

    return true;
  });

  // Group candidates by BOM No and Size to avoid duplicate identical lines
  const sizeMap = new Map<string, Array<typeof candidateRows[0]>>();
  matchingCandidates.forEach((row) => {
    const s = (row.size || row.rawRow?.["Size"] || "UNKNOWN").trim().toUpperCase();
    const b = (row.bomNo || row.rawRow?.["Production BOM No_"] || "").trim();
    const key = `${s}__${b}`;
    if (!sizeMap.has(key)) sizeMap.set(key, []);
    sizeMap.get(key)!.push(row);
  });

  // Include the current target line in the size comparison list
  const currentKey = `${targetLine.size.trim().toUpperCase()}__${targetLine.bomNo.trim()}`;
  if (!sizeMap.has(currentKey)) {
    sizeMap.set(currentKey, [
      {
        bomNo: targetLine.bomNo,
        itemNo: targetLine.itemNo,
        design: targetLine.design,
        quality: targetLine.quality,
        size: targetLine.size,
        areaSqFt: targetArea,
        componentCode: targetLine.componentCode,
        componentDescription: targetLine.componentDescription,
        plannedQty: targetAllocated,
        rawRow: targetLine.rawRow,
      },
    ]);
  }

  // Build the size columns and row-by-row comparisons
  const columns: ProportionalSizeColumn[] = [];
  const comparisonRows: ProportionalComparisonRow[] = [];
  let totalRefWeight = 0;
  let totalRefArea = 0;
  let hasSameSize = false;
  let hasDiffSize = false;

  sizeMap.forEach((rows, key) => {
    const first = rows[0];
    const s = (first.size || first.rawRow?.["Size"] || targetLine.size).trim().toUpperCase();
    const b = (first.bomNo || first.rawRow?.["Production BOM No_"] || targetLine.bomNo).trim();
    const itemNo = (first.itemNo || first.rawRow?.["Item No_"] || "").trim();
    const yarnCode = (first.componentCode || first.rawRow?.["Yarn Code"] || targetYarn).trim();
    const yarnDesc = (first.componentDescription || first.rawRow?.["Line Item Description"] || "").trim();

    const rowDesign = (first.design || first.rawRow?.["Design"] || targetDesign).trim();
    const rowGrCode = (first.grColorCode || first.rawRow?.["Ground Color"] || targetGr).trim();
    const rowGrName = (first.grColorName || first.rawRow?.["GR Color Name"] || first.rawRow?.["Ground Color Description"] || rowGrCode || "—").trim();
    const rowBrCode = (first.brColorCode || first.rawRow?.["Border Color"] || targetBr).trim();
    const rowBrName = (first.brColorName || first.rawRow?.["BR Color Name"] || first.rawRow?.["Border Color Description"] || rowBrCode || "—").trim();
    const rowColorCode = (first.rawRow?.["Color Code"] || first.rawRow?.["Matching Code"] || first.componentCode || first.rawRow?.["Yarn Code"] || rowGrCode || "—").trim();

    const area = parseRugAreaSqFt(
      s,
      first.areaSqFt || first.rawRow?.["Area (Sq_ ft_)"]
    );

    // Sum allocated weight for this BOM/component
    const allocated = rows.reduce(
      (sum, r) => sum + (r.plannedQty || r.rawRow?.["Quantity"] || 0),
      0
    );

    const isCurrent = b === targetLine.bomNo;
    const isSameSizeAsTarget = s === targetLine.size.trim().toUpperCase();

    if (!isCurrent) {
      if (isSameSizeAsTarget) hasSameSize = true;
      else hasDiffSize = true;

      if (area > 0 && allocated > 0) {
        totalRefWeight += allocated;
        totalRefArea += area;
      }
    }

    const ratePsf = area > 0 ? allocated / area : 0;

    // Calculate expected weight for the CURRENT inspected size derived from this reference size's rate:
    // Expected Weight for current size = reference rate * targetArea
    const expectedForCurrent = Math.round(ratePsf * targetArea * 1000) / 1000;

    // Difference between target's allocated weight and expected weight derived from this reference
    const deltaWeight = Math.round((targetAllocated - expectedForCurrent) * 1000) / 1000;
    const deltaPct = expectedForCurrent > 0
      ? Math.round(((targetAllocated - expectedForCurrent) / expectedForCurrent) * 1000) / 10
      : 0;

    // Rule:
    // If weight allocated < expected => "More material is needed" (Deficit)
    // If difference > +2-3% (threshold 2.5%) => "Material needs to be decreased" (Excess)
    // Else => "Optimal / Balanced Weight"
    let verdict: "DEFICIT" | "EXCESS" | "OPTIMAL" = "OPTIMAL";
    let verdictText = "Optimal / Balanced Weight";
    let statusColor: "danger" | "warning" | "success" | "accent" | "default" = "success";

    if (isCurrent) {
      verdict = "OPTIMAL";
      verdictText = "Inspected Baseline BOM";
      statusColor = "accent";
    } else if (targetAllocated < expectedForCurrent - 0.01) {
      verdict = "DEFICIT";
      verdictText = "More material is needed";
      statusColor = "warning";
    } else if (deltaPct > 2.5) {
      verdict = "EXCESS";
      verdictText = "Material needs to be decreased";
      statusColor = "danger";
    } else {
      verdict = "OPTIMAL";
      verdictText = "Optimal / Balanced Weight";
      statusColor = "success";
    }

    columns.push({
      id: key,
      size: s,
      areaSqFt: area,
      bomNo: b,
      itemNo,
      isCurrentBom: isCurrent,
      isSameSize: isSameSizeAsTarget,
      yarnCode,
      yarnDescription: yarnDesc,
      allocatedWeight: Math.round(allocated * 1000) / 1000,
      consumptionRatePsf: Math.round(ratePsf * 10000) / 10000,
      expectedWeightForCurrentSize: expectedForCurrent,
      deltaWeight,
      deltaPct,
      verdict,
      verdictText,
      statusColor,
    });

    comparisonRows.push({
      id: `row_${key}`,
      design: rowDesign,
      grColorName: rowGrName,
      grColorCode: rowGrCode,
      brColorName: rowBrName,
      brColorCode: rowBrCode,
      colorCode: rowColorCode,
      size: s,
      areaSqFt: area,
      quantity: Math.round(allocated * 1000) / 1000,
      consumptionRatePsf: Math.round(ratePsf * 10000) / 10000,
      compareSize: targetLine.size,
      compareAreaSqFt: targetArea,
      expectedQuantity: expectedForCurrent,
      deltaWeight,
      deltaPct,
      status: isCurrent
        ? "BASELINE"
        : verdict === "DEFICIT"
        ? "MORE_MATERIAL_NEEDED"
        : verdict === "EXCESS"
        ? "DECREASE_MATERIAL"
        : "OPTIMAL",
      statusText: isCurrent
        ? "Inspected Baseline"
        : verdict === "DEFICIT"
        ? "More material is needed"
        : verdict === "EXCESS"
        ? "Material needs to be decreased"
        : "Optimal",
      statusColor: isCurrent
        ? "default"
        : verdict === "DEFICIT"
        ? "warning"
        : verdict === "EXCESS"
        ? "danger"
        : "success",
      isCurrentBom: isCurrent,
      isSameSize: isSameSizeAsTarget,
      bomNo: b,
      itemNo,
      yarnCode,
    });
  });

  // Sort columns and comparison rows: Inspected BOM first, then Same Size Matches, then by Area ascending
  const sortFn = (a: { isCurrentBom: boolean; isSameSize: boolean; areaSqFt: number }, b: { isCurrentBom: boolean; isSameSize: boolean; areaSqFt: number }) => {
    if (a.isCurrentBom) return -1;
    if (b.isCurrentBom) return 1;
    if (a.isSameSize && !b.isSameSize) return -1;
    if (!a.isSameSize && b.isSameSize) return 1;
    return a.areaSqFt - b.areaSqFt;
  };

  columns.sort(sortFn);
  comparisonRows.sort(sortFn);

  // Calculate Benchmark Average Rate (across reference sizes)
  let benchmarkRate = 0;
  if (totalRefArea > 0 && totalRefWeight > 0) {
    benchmarkRate = totalRefWeight / totalRefArea;
  } else if (targetArea > 0) {
    benchmarkRate = targetAllocated / targetArea;
  }

  const benchmarkExpected = Math.round(benchmarkRate * targetArea * 1000) / 1000;
  const benchmarkDelta = Math.round((targetAllocated - benchmarkExpected) * 1000) / 1000;
  const benchmarkPct = benchmarkExpected > 0
    ? Math.round(((targetAllocated - benchmarkExpected) / benchmarkExpected) * 1000) / 10
    : 0;

  let benchmarkVerdict: "DEFICIT" | "EXCESS" | "OPTIMAL" = "OPTIMAL";
  let benchmarkVerdictText = "Optimal / Balanced Weight";

  if (targetAllocated < benchmarkExpected - 0.01) {
    benchmarkVerdict = "DEFICIT";
    benchmarkVerdictText = "More material is needed";
  } else if (benchmarkPct > 2.5) {
    benchmarkVerdict = "EXCESS";
    benchmarkVerdictText = "Material needs to be decreased";
  } else {
    benchmarkVerdict = "OPTIMAL";
    benchmarkVerdictText = "Optimal / Balanced Weight";
  }

  const distinctSizes = new Set(columns.map((c) => c.size));

  return {
    design: targetDesign,
    quality: targetQuality,
    grColor: targetGr,
    brColor: targetBr,
    yarnCode: targetYarn,
    yarnDescription: targetLine.componentDescription,
    currentTarget: {
      bomNo: targetLine.bomNo,
      itemNo: targetLine.itemNo,
      size: targetLine.size,
      areaSqFt: targetArea,
      allocatedWeight: targetAllocated,
      consumptionRatePsf: Math.round(targetRatePsf * 10000) / 10000,
    },
    referenceColumns: columns,
    comparisonRows: comparisonRows,
    benchmarkRatePsf: Math.round(benchmarkRate * 10000) / 10000,
    benchmarkExpectedWeight: benchmarkExpected,
    benchmarkDeltaWeight: benchmarkDelta,
    benchmarkDeltaPct: benchmarkPct,
    benchmarkVerdict,
    benchmarkVerdictText,
    hasSameSizeMatches: hasSameSize,
    hasDifferentSizeMatches: hasDiffSize,
    totalMatchesCount: columns.length,
    distinctSizesCount: distinctSizes.size,
  };
}
