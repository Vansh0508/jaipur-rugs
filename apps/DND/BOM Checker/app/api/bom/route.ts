import { NextRequest, NextResponse } from "next/server";
import { queryBomDetails, isMssqlConfigured } from "@/lib/mssql";
import { auditBomRows } from "@/lib/audit-engine";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const prefix = searchParams.get("prefix") || undefined;
    const itemNo = searchParams.get("itemNo") || undefined;
    const statusFilter = searchParams.get("status") || "ALL";
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 1000;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;
    const bypassCache = searchParams.get("bypassCache") === "true" || searchParams.get("refresh") === "true";

    const result = await queryBomDetails({
      searchTerm: search,
      designPrefix: prefix,
      itemNo,
      limit,
      offset,
      bypassCache,
    });

    const { auditedLines, summary } = await auditBomRows(result.rows);

    let filteredLines = auditedLines;
    if (statusFilter === "DISCREPANCIES") {
      filteredLines = auditedLines.filter((l) => l.status !== "VALID");
    } else if (statusFilter === "INVALID_CODE") {
      filteredLines = auditedLines.filter((l) => l.status === "INVALID_CODE");
    } else if (statusFilter === "BELOW_AVG_QUANTITY") {
      filteredLines = auditedLines.filter((l) => l.status === "BELOW_AVG_QUANTITY");
    } else if (statusFilter === "VALID") {
      filteredLines = auditedLines.filter((l) => l.status === "VALID");
    }

    return NextResponse.json({
      success: true,
      lines: filteredLines,
      summary,
      offset,
      limit,
      count: filteredLines.length,
      hasMore: result.rows.length === limit,
      isLive: result.isLive,
      isCached: (result as any).isCached || false,
      isMssqlConfigured: isMssqlConfigured(),
      errorMessage: result.errorMessage,
    });
  } catch (error: any) {
    console.error("API /api/bom error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch BOM data" },
      { status: 500 }
    );
  }
}
