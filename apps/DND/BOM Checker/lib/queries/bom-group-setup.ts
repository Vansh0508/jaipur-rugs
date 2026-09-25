import sql from "mssql";
import { getMssqlPool, isMssqlConfigured } from "@/lib/mssql";
import { mssqlCache } from "@/lib/mssql-cache";

export interface BomGroupSetupRecord {
  bomNo: string;
  itemNo: string;
  itemDescription: string;
  design: string;
  quality: string;
  groupItemNo: string | null;
  yarnCode: string | null;
  packingKgSqFt: number | null;
  standardKgSqFt: number | null;
  extraKgSqFt: number | null;
  contribution: number | null;
  totalGroupedPacking: number | null;
  totalGroupedStandard: number | null;
  taniPackingValue: number | null;
  thedaPackingValue: number | null;
  lacchiPackingValue: number | null;
}

export interface BomGroupSetupFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  groupItemNo?: string;
  design?: string;
  onlyConfigured?: boolean;
}

export interface BomGroupSetupResult {
  records: BomGroupSetupRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLive: boolean;
  errorMessage?: string;
}

/**
 * Fetch paginated records from [dbo].[Production BOM Group Item No Setup]
 */
export async function fetchBomGroupSetupRecords(
  filters: BomGroupSetupFilters = {}
): Promise<BomGroupSetupResult> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(filters.pageSize || 20, 100));
  const offset = (page - 1) * pageSize;
  const search = (filters.search || "").trim();
  const groupItemNo = (filters.groupItemNo || "").trim();
  const design = (filters.design || "").trim();
  const onlyConfigured = filters.onlyConfigured ?? false;

  const cacheKey = `bom-group-setup:${page}:${pageSize}:${search}:${groupItemNo}:${design}:${onlyConfigured}`;
  const cached = mssqlCache.get<BomGroupSetupResult>(cacheKey);
  if (cached) {
    return cached;
  }

  if (!isMssqlConfigured()) {
    return {
      records: [],
      totalCount: 0,
      page,
      pageSize,
      totalPages: 0,
      isLive: false,
      errorMessage: "MS SQL Server is not configured in .env.local",
    };
  }

  try {
    const pool = await getMssqlPool();
    const request = pool.request();

    let whereConditions: string[] = ["[No_] != '' AND [No_] != 'V'"];

    if (search) {
      const cleanSearch = search.trim();
      const bomCandidates = new Set<string>();
      bomCandidates.add(cleanSearch);
      bomCandidates.add(cleanSearch.toUpperCase());

      // If user typed purely digits (e.g. "148425", "25", "00001", "1")
      if (/^\d+$/.test(cleanSearch)) {
        bomCandidates.add(`JRC/PRDBOM/${cleanSearch}`);
        bomCandidates.add(`JRC/PRDBOM/${cleanSearch.padStart(5, "0")}`);
        bomCandidates.add(`JRC/PRDBOM/${cleanSearch.padStart(6, "0")}`);
        bomCandidates.add(`JRC/BOM-DY/${cleanSearch.padStart(5, "0")}`);
        bomCandidates.add(`CT/BOM/${cleanSearch.padStart(4, "0")}`);
      }

      // If user typed without "JRC/" (e.g. "PRDBOM/148425", "BOM-DY/00123")
      if (/^PRDBOM\//i.test(cleanSearch)) {
        bomCandidates.add(`JRC/${cleanSearch.toUpperCase()}`);
      }
      if (/^BOM-/i.test(cleanSearch)) {
        bomCandidates.add(`JRC/${cleanSearch.toUpperCase()}`);
        bomCandidates.add(`JR/${cleanSearch.toUpperCase()}`);
      }

      const isItemNo =
        /^rug/i.test(cleanSearch) ||
        /^rm\d/i.test(cleanSearch) ||
        /^ct-\d/i.test(cleanSearch);

      const isBOM =
        /^\d+$/.test(cleanSearch) ||
        /bom/i.test(cleanSearch) ||
        /^(jrc|jr|ct|pwc|silkyarn)\//i.test(cleanSearch);

      if (isBOM) {
        // Exact BOM Number matching (instant index seek in <100ms)
        const bomConds: string[] = [];
        const candidatesArr = Array.from(bomCandidates);
        candidatesArr.forEach((c, idx) => {
          request.input(`bomCand${idx}`, sql.NVarChar, c);
          bomConds.push(`[No_] = @bomCand${idx}`);
        });

        if (cleanSearch.includes("/")) {
          request.input("bomPrefix", sql.NVarChar, `${cleanSearch}%`);
          bomConds.push(`[No_] LIKE @bomPrefix`);
        }
        whereConditions.push(`(${bomConds.join(" OR ")})`);
      } else if (isItemNo) {
        request.input("itemSearch", sql.NVarChar, cleanSearch);
        request.input("itemPrefix", sql.NVarChar, `${cleanSearch}%`);
        whereConditions.push(`([Item No_] = @itemSearch OR [Item No_] LIKE @itemPrefix)`);
      } else {
        // Design or general search
        request.input("designPrefix", sql.NVarChar, `${cleanSearch}%`);
        whereConditions.push(`([Design] LIKE @designPrefix)`);
      }
    }

    if (groupItemNo) {
      whereConditions.push(`[Group Item No_] = @groupItemNo`);
      request.input("groupItemNo", sql.NVarChar, groupItemNo);
    }

    if (design) {
      whereConditions.push(`[Design] LIKE @design`);
      request.input("design", sql.NVarChar, `${design}%`);
    }

    if (onlyConfigured) {
      whereConditions.push(`[Group Item No_] IS NOT NULL AND [Group Item No_] != ''`);
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    // Optimized count: full-table scan COUNT(*) on this massive view times out if unfiltered.
    // Use partition stats for instant 1ms unfiltered total count, or filtered count query when user searches.
    let totalCount = 0;
    const hasFilters = Boolean(search || groupItemNo || design || onlyConfigured);

    if (hasFilters) {
      const countQuery = `
        SELECT COUNT(*) AS total
        FROM [dbo].[Production BOM Group Item No Setup]
        ${whereClause}
      `;
      const countResult = await request.query(countQuery);
      const cnt = countResult.recordset[0]?.total;
      totalCount = typeof cnt === "number" ? cnt : Number(cnt || 0);
    } else {
      const cachedCount = mssqlCache.get<number>("bom-group-setup-unfiltered-count");
      if (typeof cachedCount === "number") {
        totalCount = cachedCount;
      } else {
        try {
          const partRes = await pool.request().query(`
            SELECT SUM(row_count) AS total
            FROM sys.dm_db_partition_stats
            WHERE object_id = OBJECT_ID('dbo.JRCPL Live$BOM Group Item No_ Setup') AND index_id < 2
          `);
          const val = partRes.recordset[0]?.total;
          totalCount = typeof val === "number" ? val : Number(val || 85400);
        } catch {
          totalCount = 85400;
        }
        mssqlCache.set("bom-group-setup-unfiltered-count", totalCount, 60 * 60 * 1000);
      }
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Paginated records query - sorted by newest creations (highest numeric BOM No)
    request.input("offset", sql.Int, offset);
    request.input("pageSize", sql.Int, pageSize);

    const dataQuery = `
      SELECT
        [No_],
        [Item No_],
        [Item Description],
        [Design],
        [Quality],
        [Group Item No_],
        [Yarn Code],
        [Packing (kg_sq_ft_)],
        [Standard (kg_sq_ft_)],
        [Extra(kg_sq_ft_)],
        [Contribution _],
        [Total Grouped Packing],
        [Total Grouped Standard],
        [Tani Packing Value],
        [Theda Packing Value],
        [Lacchi Packing Value]
      FROM [dbo].[Production BOM Group Item No Setup]
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN [No_] LIKE 'JRC/PRDBOM/1%' THEN 1
          WHEN [No_] LIKE 'JRC/PRDBOM/%' THEN 2
          WHEN [No_] LIKE 'JRC/BOM-DY/%' THEN 3
          ELSE 4
        END ASC,
        [No_] DESC,
        [Group Item No_] ASC
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `;

    const dataResult = await request.query(dataQuery);

    const records: BomGroupSetupRecord[] = dataResult.recordset.map((row: any) => ({
      bomNo: (row["No_"] || "").trim(),
      itemNo: (row["Item No_"] || "").trim(),
      itemDescription: (row["Item Description"] || "").trim(),
      design: (row["Design"] || "").trim(),
      quality: (row["Quality"] || "").trim(),
      groupItemNo: row["Group Item No_"] ? String(row["Group Item No_"]).trim() : null,
      yarnCode: row["Yarn Code"] ? String(row["Yarn Code"]).trim() : null,
      packingKgSqFt: row["Packing (kg_sq_ft_)"] !== null ? Number(row["Packing (kg_sq_ft_)"]) : null,
      standardKgSqFt: row["Standard (kg_sq_ft_)"] !== null ? Number(row["Standard (kg_sq_ft_)"]) : null,
      extraKgSqFt: row["Extra(kg_sq_ft_)"] !== null ? Number(row["Extra(kg_sq_ft_)"]) : null,
      contribution: row["Contribution _"] !== null ? Number(row["Contribution _"]) : null,
      totalGroupedPacking: row["Total Grouped Packing"] !== null ? Number(row["Total Grouped Packing"]) : null,
      totalGroupedStandard: row["Total Grouped Standard"] !== null ? Number(row["Total Grouped Standard"]) : null,
      taniPackingValue: row["Tani Packing Value"] !== null ? Number(row["Tani Packing Value"]) : null,
      thedaPackingValue: row["Theda Packing Value"] !== null ? Number(row["Theda Packing Value"]) : null,
      lacchiPackingValue: row["Lacchi Packing Value"] !== null ? Number(row["Lacchi Packing Value"]) : null,
    }));

    const result: BomGroupSetupResult = {
      records,
      totalCount,
      page,
      pageSize,
      totalPages,
      isLive: true,
    };

    // Cache for 5 minutes
    mssqlCache.set(cacheKey, result, 5 * 60 * 1000);
    return result;
  } catch (err: any) {
    console.error("Error querying [dbo].[Production BOM Group Item No Setup]:", err.message);
    return {
      records: [],
      totalCount: 0,
      page,
      pageSize,
      totalPages: 0,
      isLive: false,
      errorMessage: err.message,
    };
  }
}
