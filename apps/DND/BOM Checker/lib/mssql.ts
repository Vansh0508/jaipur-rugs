import sql from "mssql";
import { mssqlCache } from "./mssql-cache";

let pool: sql.ConnectionPool | null = null;

export function isMssqlConfigured(): boolean {
  return !!(
    process.env.MSSQL_SERVER &&
    process.env.MSSQL_DATABASE &&
    process.env.MSSQL_USER &&
    process.env.MSSQL_PASSWORD
  );
}

export async function getMssqlPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  if (!isMssqlConfigured()) {
    throw new Error(
      "MS SQL Server configuration is missing in .env.local. Please provide MSSQL_SERVER, MSSQL_DATABASE, MSSQL_USER, MSSQL_PASSWORD."
    );
  }

  const server = (process.env.MSSQL_SERVER || "").trim();
  const port = process.env.MSSQL_PORT ? parseInt(process.env.MSSQL_PORT, 10) : 1433;
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(server);

  // If encrypt is explicitly set in env to "false", or if it's an IP address and not explicitly "true", default to false.
  const encryptEnv = process.env.MSSQL_ENCRYPT;
  const encrypt = encryptEnv === "true" ? true : encryptEnv === "false" ? false : !isIp;
  const trustServerCertificate = process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== "false";

  const config: sql.config = {
    server,
    port: isNaN(port) ? 1433 : port,
    database: process.env.MSSQL_DATABASE as string,
    user: process.env.MSSQL_USER as string,
    password: process.env.MSSQL_PASSWORD as string,
    options: {
      encrypt,
      trustServerCertificate,
      enableArithAbort: true,
      connectTimeout: 20000,
      requestTimeout: 45000,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  try {
    pool = await new sql.ConnectionPool(config).connect();
    console.log("Connected to MS SQL Database successfully.");
    return pool;
  } catch (error) {
    console.error("MS SQL connection error:", error);
    throw error;
  }
}

export interface BomQueryFilters {
  searchTerm?: string;
  designPrefix?: string;
  itemNo?: string;
  limit?: number;
  offset?: number;
  bypassCache?: boolean;
}

/**
 * Fetch rows from the hosted view [dbo].[NAV-004- Item wise BOM Details_FG-HN]
 */
export async function queryBomDetails(filters: BomQueryFilters = {}) {
  const limit = Math.min(filters.limit || 1000, 10000);
  const offset = Math.max(filters.offset || 0, 0);

  const cacheKey = `bom-query:${filters.itemNo || ""}:${filters.searchTerm || ""}:${filters.designPrefix || ""}:${limit}:${offset}`;

  // Check server cache if not explicitly bypassing
  if (!filters.bypassCache) {
    const cached = mssqlCache.get<{ rows: any[]; totalCount: number; isLive: boolean }>(cacheKey);
    if (cached) {
      return {
        ...cached,
        isCached: true,
        errorMessage: undefined,
      };
    }
  }

  if (!isMssqlConfigured()) {
    console.warn("MS SQL not configured; using fallback sample data for development/preview.");
    return getFallbackBomData(filters);
  }

  try {
    const activePool = await getMssqlPool();
    const request = activePool.request();

    let whereClause = ` WHERE 1=1 `;
    if (filters.itemNo) {
      whereClause += ` AND [Item No_] = @itemNo`;
      request.input("itemNo", sql.NVarChar, filters.itemNo);
    }

    if (filters.searchTerm) {
      whereClause += ` AND (
        [Production BOM No_] LIKE @search
        OR [Item No_] LIKE @search 
        OR [Matching Code] LIKE @search
        OR [Item Description] LIKE @search 
        OR [Design] LIKE @search
        OR [Line Item Description] LIKE @search
        OR [Yarn Code] LIKE @search
      )`;
      request.input("search", sql.NVarChar, `%${filters.searchTerm}%`);
    }

    if (filters.designPrefix) {
      whereClause += ` AND ([Design] LIKE @prefix OR [Item No_] LIKE @prefix)`;
      request.input("prefix", sql.NVarChar, `${filters.designPrefix}%`);
    }

    request.input("limit", sql.Int, limit);
    request.input("offset", sql.Int, offset);

    let query = "";
    if (offset > 0) {
      query = `
        SELECT *
        FROM [dbo].[NAV-004- Item wise BOM Details_FG-HN]
        ${whereClause}
        ORDER BY COALESCE([BOM Creation Date], [Last Date Modified]) DESC, [Production BOM No_] DESC, [Line No_] ASC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `;
    } else {
      query = `
        SELECT TOP (@limit) *
        FROM [dbo].[NAV-004- Item wise BOM Details_FG-HN]
        ${whereClause}
        ORDER BY COALESCE([BOM Creation Date], [Last Date Modified]) DESC, [Production BOM No_] DESC, [Line No_] ASC
      `;
    }

    const result = await request.query(query);
    const response = {
      rows: result.recordset,
      totalCount: result.recordset.length,
      isLive: true,
      isCached: false,
      errorMessage: undefined,
    };
    mssqlCache.set(cacheKey, response, 10 * 60 * 1000);
    return response;
  } catch (err: any) {
    console.error("Error executing query against MS SQL view:", err.message);
    console.warn("Returning fallback demo data due to MS SQL query failure.");
    return getFallbackBomData(filters, err.message);
  }
}

/**
 * High-fidelity fallback/mock data mirroring the actual Jaipur Rugs BOM NAV-004 view
 */
function getFallbackBomData(filters: BomQueryFilters, errorMessage?: string) {
  const mockRows = [
    {
      "Item No_": "RUG1024964",
      "Item Description": "Rugs RCT 9X12 11/11 RHS WL SPR-05 Beige Copper",
      "Design": "SPR-05",
      "Quality": "11/11 RHS WL",
      "Line No_": 10000,
      "Line Item": "RM129828",
      "Yarn Code": "10",
      "Line Item Description": "Wool Yarn 1 Ply 26-32 Dyed RHS Standard Spooled",
      "Quantity": 13.468,
      "Quantity per": 13.468,
      "Standard Qty": 13.468,
      "Standard PSF": 0.1297,
      "Size": "9X12",
      "Area (Sq_ ft_)": 103.79,
      "Status": "Certified",
      "Production BOM No_": "JRC/PRDBOM/00001",
      "Base Material": "Wool",
    },
    {
      "Item No_": "RUG1024965",
      "Item Description": "Rugs RCT 8X10 Handloom Double Back HPBS-7001 White",
      "Design": "HPBS-7001",
      "Quality": "Handloom Double Back",
      "Line No_": 10000,
      "Line Item": "RM145230",
      "Yarn Code": "30",
      "Line Item Description": "Wool Yarn 30 Count Undyed",
      "Quantity": 14.5,
      "Quantity per": 14.5,
      "Standard Qty": 15.0,
      "Standard PSF": 0.187,
      "Size": "8x10",
      "Area (Sq_ ft_)": 80.0,
      "Status": "Certified",
      "Production BOM No_": "JRC/PRDBOM/00002",
      "Base Material": "Wool",
    },
    {
      // ANOMALY: Code '88' is NOT in approved yarns for LE (LE only allows 99, 63, 10, 11, 20)
      "Item No_": "RUG1024966",
      "Item Description": "Rugs RCT 6X9 8/8 LE-9216 Blue Ivory",
      "Design": "LE-9216",
      "Quality": "8/8",
      "Line No_": 20000,
      "Line Item": "RM159931",
      "Yarn Code": "88",
      "Line Item Description": "Unapproved Acrylic Blend Yarn 88",
      "Quantity": 12.0,
      "Quantity per": 12.0,
      "Standard Qty": 11.5,
      "Standard PSF": 0.213,
      "Size": "6x9",
      "Area (Sq_ ft_)": 54.0,
      "Status": "Certified",
      "Production BOM No_": "JRC/PRDBOM/00003",
      "Base Material": "Acrylic",
    },
    {
      // ANOMALY: Below average quantity for size proportion (only 4.2 kg for an 8x10 rug where standard is 9.8)
      "Item No_": "RUG1024967",
      "Item Description": "Rugs RCT 8X10 6/6 LRB-13022 Grey Charcoal",
      "Design": "LRB-13022",
      "Quality": "6/6",
      "Line No_": 30000,
      "Line Item": "RM178822",
      "Yarn Code": "44",
      "Line Item Description": "Cotton Tani Yarn 44 White",
      "Quantity": 4.2,
      "Quantity per": 4.2,
      "Standard Qty": 9.8,
      "Standard PSF": 0.0525,
      "Size": "8x10",
      "Area (Sq_ ft_)": 80.0,
      "Status": "Certified",
      "Production BOM No_": "JRC/PRDBOM/00004",
      "Base Material": "Cotton",
    },
    {
      // Standard D&D yarn code: 'TH' (considered OK/Valid despite not being in registered yarn list)
      "Item No_": "RUG1024968",
      "Item Description": "Rugs RCT 9X12 11/11 RHS WL SPR-05 Natural TH",
      "Design": "SPR-05",
      "Quality": "11/11 RHS WL",
      "Line No_": 40000,
      "Line Item": "RM189910",
      "Yarn Code": "TH",
      "Line Item Description": "Wool Standard TH Component",
      "Quantity": 13.468,
      "Quantity per": 13.468,
      "Standard Qty": 13.468,
      "Standard PSF": 0.1297,
      "Size": "9X12",
      "Area (Sq_ ft_)": 103.79,
      "Status": "Certified",
      "Production BOM No_": "JRC/PRDBOM/00001",
      "Base Material": "Wool",
    },
    {
      // Standard D&D yarn code: 'TN' (considered OK/Valid despite not being in registered yarn list)
      "Item No_": "RUG1024969",
      "Item Description": "Rugs RCT 8X10 Handloom Double Back HPBS-7001 TN Natural",
      "Design": "HPBS-7001",
      "Quality": "Handloom Double Back",
      "Line No_": 50000,
      "Line Item": "RM190012",
      "Yarn Code": "TN",
      "Line Item Description": "Wool Standard TN Component",
      "Quantity": 15.0,
      "Quantity per": 15.0,
      "Standard Qty": 15.0,
      "Standard PSF": 0.187,
      "Size": "8x10",
      "Area (Sq_ ft_)": 80.0,
      "Status": "Certified",
      "Production BOM No_": "JRC/PRDBOM/00002",
      "Base Material": "Wool",
    },
  ];

  let filtered = mockRows;
  if (filters.itemNo) {
    const itemNo = filters.itemNo.trim().toLowerCase();
    filtered = filtered.filter((r) => r["Item No_"]?.toLowerCase() === itemNo);
  }
  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r["Item No_"].toLowerCase().includes(term) ||
        r["Item Description"].toLowerCase().includes(term) ||
        r["Design"].toLowerCase().includes(term) ||
        r["Yarn Code"].toLowerCase().includes(term)
    );
  }
  if (filters.designPrefix) {
    const pfx = filters.designPrefix.toUpperCase();
    filtered = filtered.filter(
      (r) =>
        r["Design"].toUpperCase().startsWith(pfx) ||
        r["Item No_"].toUpperCase().startsWith(pfx)
    );
  }

  const offset = Math.max(filters.offset || 0, 0);
  const limit = filters.limit || 1000;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    rows: paginated,
    totalCount: filtered.length,
    isLive: false,
    errorMessage,
  };
}
