import { NextResponse } from "next/server";
import { fetchBomGroupSetupRecords } from "@/lib/queries/bom-group-setup";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const search = searchParams.get("search") || searchParams.get("q") || "";
    const groupItemNo = searchParams.get("groupItemNo") || "";
    const design = searchParams.get("design") || "";
    const onlyConfigured = searchParams.get("onlyConfigured") === "true";

    const result = await fetchBomGroupSetupRecords({
      page,
      pageSize,
      search,
      groupItemNo,
      design,
      onlyConfigured,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("API error in /api/bom-group-setup:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch BOM group setup records",
      },
      { status: 500 }
    );
  }
}
