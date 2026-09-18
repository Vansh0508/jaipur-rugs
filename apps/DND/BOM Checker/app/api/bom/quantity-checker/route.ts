import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getMssqlPool, isMssqlConfigured } from "@/lib/mssql";
import { computeQuantityChecker, QuantityCheckerResult } from "@/lib/quantity-checker";
import { mssqlCache } from "@/lib/mssql-cache";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const design = searchParams.get("design") || "";
    const quality = searchParams.get("quality") || "";
    const grColor = searchParams.get("grColor") || "";
    const brColor = searchParams.get("brColor") || "";
    const yarnCode = searchParams.get("yarnCode") || "";
    const currentBomNo = searchParams.get("currentBomNo") || "";
    const currentItemNo = searchParams.get("currentItemNo") || "";
    const currentSize = searchParams.get("currentSize") || "";
    const targetAllocated = parseFloat(searchParams.get("targetAllocated") || "0");
    const targetArea = parseFloat(searchParams.get("targetArea") || "0");
    const bypassCache = searchParams.get("bypassCache") === "true" || searchParams.get("refresh") === "true";

    const targetLine = {
      bomNo: currentBomNo,
      itemNo: currentItemNo,
      design,
      quality,
      grColorCode: grColor,
      brColorCode: brColor,
      size: currentSize,
      areaSqFt: targetArea,
      componentCode: yarnCode,
      plannedQty: targetAllocated,
    };

    if (!design) {
      return NextResponse.json(
        { success: false, error: "Design parameter is required" },
        { status: 400 }
      );
    }

    let candidateRows: any[] = [];
    let isLive = false;
    let isCached = false;

    // Cache key for quantity checker query
    const cacheKey = `qc:${design.trim().toUpperCase()}:${quality.trim().toUpperCase()}:${grColor.trim().toUpperCase()}:${brColor.trim().toUpperCase()}:${yarnCode.trim().toUpperCase()}`;

    // Check server cache
    if (!bypassCache) {
      const cachedRows = mssqlCache.get<any[]>(cacheKey);
      if (cachedRows) {
        candidateRows = cachedRows;
        isLive = true;
        isCached = true;
      }
    }

    if (!isCached && isMssqlConfigured()) {
      try {
        const pool = await getMssqlPool();
        const req = pool.request();
        req.input("design", sql.NVarChar, design.trim());
        req.input("quality", sql.NVarChar, quality.trim());

        let whereClause = `
          WHERE [Design] = @design 
        `;

        if (quality) {
          whereClause += ` AND [Quality] = @quality `;
        }

        if (grColor) {
          req.input("gr", sql.NVarChar, grColor.trim());
          whereClause += ` AND ([Ground Color] = @gr OR [Ground Color Description] = @gr) `;
        }

        if (brColor) {
          req.input("br", sql.NVarChar, brColor.trim());
          whereClause += ` AND ([Border Color] = @br OR [Border Color Description] = @br) `;
        }

        if (yarnCode) {
          req.input("yarn", sql.NVarChar, yarnCode.trim());
          whereClause += ` AND [Yarn Code] = @yarn `;
        }

        const query = `
          SELECT TOP 200
            [Production BOM No_],
            [Item No_],
            [Design],
            [Quality],
            [Ground Color],
            [Ground Color Description],
            [Border Color],
            [Border Color Description],
            [Matching Code],
            [Size],
            [Area (Sq_ ft_)],
            [Line Item],
            [Line Item Description],
            [Yarn Code],
            [Quantity],
            [Standard PSF]
          FROM [dbo].[NAV-004- Item wise BOM Details_FG-HN]
          ${whereClause}
          ORDER BY [Size], [Production BOM No_]
        `;

        const dbRes = await req.query(query);
        candidateRows = dbRes.recordset;
        isLive = true;

        // Cache candidate rows for 15 minutes
        if (candidateRows.length > 0) {
          mssqlCache.set(cacheKey, candidateRows, 15 * 60 * 1000);
        }
      } catch (dbErr: any) {
        console.warn("MS SQL error querying quantity checker:", dbErr.message);
      }
    }

    // Run the proportional calculator
    const result: QuantityCheckerResult = computeQuantityChecker(
      targetLine,
      candidateRows.map((r) => ({
        bomNo: r["Production BOM No_"],
        itemNo: r["Item No_"],
        design: r["Design"],
        quality: r["Quality"],
        grColorCode: r["Ground Color"],
        grColorName: r["Ground Color Description"],
        brColorCode: r["Border Color"],
        brColorName: r["Border Color Description"],
        matchingCode: r["Matching Code"],
        size: r["Size"],
        areaSqFt: r["Area (Sq_ ft_)"],
        componentCode: r["Yarn Code"],
        componentDescription: r["Line Item Description"],
        plannedQty: r["Quantity"],
        standardPsf: r["Standard PSF"],
        rawRow: r,
      }))
    );

    return NextResponse.json({
      success: true,
      isLive,
      isCached,
      data: result,
    });
  } catch (err: any) {
    console.error("Error in /api/bom/quantity-checker:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to run quantity checker" },
      { status: 500 }
    );
  }
}
