import sql from "mssql";
import { getMssqlPool, isMssqlConfigured } from "@/lib/mssql";
import { mssqlCache } from "@/lib/mssql-cache";

export interface DesignMasterRecord {
  code: string;
  prefix: string;
  description: string;
  indianDesignName: string;
  usDesignName: string;
  designGroupCode: string;
  collectionCode: string;
  primaryStyleCode: string;
  primaryPatternCode: string;
  designer: string;
  brandCode: string;
  pileFibre: string;
  qualityDetail: string;
  pileHeight: string;
  creationDate: string | null;
  createdBy: string;
  blocked: boolean;
}

export interface DesignMasterFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  pileFibre?: string;
  styleCode?: string;
  sortBy?: "code" | "creationDate";
  sortDir?: "asc" | "desc";
}

/**
 * Extracts the design prefix from a design code or group code.
 * Rules:
 * 1. If explicit designGroupCode exists, use it.
 * 2. Otherwise extract the pre part of the design code before the hyphen '-'
 * 3. Handles codes wrapped in parentheses, e.g. (TAQ-4305CS-01) -> TAQ
 */
export function extractDesignPrefix(code: string, designGroupCode?: string): string {
  const cleanGroup = (designGroupCode || "").trim();
  if (cleanGroup) {
    return cleanGroup.toUpperCase();
  }
  const cleanCode = (code || "").trim();
  const stripped = cleanCode.replace(/^[(\[]+/, "");
  if (stripped.includes("-")) {
    const pre = stripped.split("-")[0].trim().toUpperCase();
    if (pre) return pre;
  }
  return cleanCode.toUpperCase() || "—";
}

export interface DesignMasterResult {
  records: DesignMasterRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLive: boolean;
  errorMessage?: string;
}

/**
 * Fetch paginated records from [dbo].[JRCPL Live$Design]
 */
export async function fetchDesignMasterRecords(
  filters: DesignMasterFilters = {}
): Promise<DesignMasterResult> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(filters.pageSize || 20, 100));
  const offset = (page - 1) * pageSize;
  const search = (filters.search || "").trim();
  const pileFibre = (filters.pileFibre || "").trim();
  const styleCode = (filters.styleCode || "").trim();
  const sortBy = filters.sortBy || "code";
  const sortDir = filters.sortDir || (sortBy === "creationDate" ? "desc" : "asc");

  // Cache key for quick repeated queries
  const cacheKey = `design-master:${page}:${pageSize}:${search}:${pileFibre}:${styleCode}:${sortBy}:${sortDir}`;
  const cached = mssqlCache.get<DesignMasterResult>(cacheKey);
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

    let whereConditions: string[] = ["1=1"];

    if (search) {
      whereConditions.push(`(
        [Code] LIKE @search
        OR [Description] LIKE @search
        OR [Indian Design Name] LIKE @search
        OR [US Design Name] LIKE @search
        OR [Quality Detail] LIKE @search
        OR [Pile Fibre] LIKE @search
        OR [Created By] LIKE @search
        OR [Design Group Code] LIKE @search
      )`);
      request.input("search", sql.NVarChar, `%${search}%`);
    }

    if (pileFibre) {
      whereConditions.push(`[Pile Fibre] = @pileFibre`);
      request.input("pileFibre", sql.NVarChar, pileFibre);
    }

    if (styleCode) {
      whereConditions.push(`[Primary Style Code] = @styleCode`);
      request.input("styleCode", sql.NVarChar, styleCode);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    // Total Count query
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM [dbo].[JRCPL Live$Design]
      ${whereClause}
    `;
    const countResult = await request.query(countQuery);
    const totalCount: number = countResult.recordset[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Order clause based on sortBy
    let orderClause = `ORDER BY [Code] ASC`;
    if (sortBy === "creationDate") {
      orderClause = `ORDER BY [Creation Date] ${sortDir === "asc" ? "ASC" : "DESC"}, [Code] ASC`;
    } else {
      orderClause = `ORDER BY [Code] ${sortDir === "desc" ? "DESC" : "ASC"}`;
    }

    // Paginated records query
    request.input("offset", sql.Int, offset);
    request.input("pageSize", sql.Int, pageSize);

    const dataQuery = `
      SELECT
        [Code],
        [Description],
        [Indian Design Name],
        [US Design Name],
        [Design Group Code],
        [Collection Code],
        [Primary Style Code],
        [Primary Pattern Code],
        [Designer],
        [Brand Code],
        [Pile Fibre],
        [Quality Detail],
        [Pile Height in MM],
        [Creation Date],
        [Created By],
        [Blocked]
      FROM [dbo].[JRCPL Live$Design]
      ${whereClause}
      ${orderClause}
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `;

    const dataResult = await request.query(dataQuery);

    const records: DesignMasterRecord[] = dataResult.recordset.map((row: any) => {
      const code = (row["Code"] || "").trim();
      const designGroupCode = (row["Design Group Code"] || "").trim();
      return {
        code,
        prefix: extractDesignPrefix(code, designGroupCode),
        description: (row["Description"] || "").trim(),
        indianDesignName: (row["Indian Design Name"] || "").trim(),
        usDesignName: (row["US Design Name"] || "").trim(),
        designGroupCode,
        collectionCode: (row["Collection Code"] || "").trim(),
        primaryStyleCode: (row["Primary Style Code"] || "").trim(),
        primaryPatternCode: (row["Primary Pattern Code"] || "").trim(),
        designer: (row["Designer"] || "").trim(),
        brandCode: (row["Brand Code"] || "").trim(),
        pileFibre: (row["Pile Fibre"] || "").trim(),
        qualityDetail: (row["Quality Detail"] || "").trim(),
        pileHeight: (row["Pile Height in MM"] || "").trim(),
        creationDate: row["Creation Date"]
          ? new Date(row["Creation Date"]).toISOString().split("T")[0]
          : null,
        createdBy: (row["Created By"] || "").trim(),
        blocked: Boolean(row["Blocked"]),
      };
    });

    const result: DesignMasterResult = {
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
    console.error("Error querying [dbo].[JRCPL Live$Design]:", err.message);
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
