import { NextResponse } from "next/server";
import { fetchDesignMasterRecords } from "@/lib/queries/design-master";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const search = searchParams.get("search") || searchParams.get("q") || "";
    const pileFibre = searchParams.get("pileFibre") || "";
    const styleCode = searchParams.get("styleCode") || "";
    const sortBy = (searchParams.get("sortBy") as "code" | "creationDate") || "code";
    const sortDir = (searchParams.get("sortDir") as "asc" | "desc") || "asc";

    const result = await fetchDesignMasterRecords({
      page,
      pageSize,
      search,
      pileFibre,
      styleCode,
      sortBy,
      sortDir,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("API error in /api/design-master:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch design master records",
      },
      { status: 500 }
    );
  }
}
