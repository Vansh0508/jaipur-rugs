import { NextRequest, NextResponse } from "next/server";
import { queryBomDetails } from "@/lib/mssql";
import { auditBomRows } from "@/lib/audit-engine";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const prefix = searchParams.get("prefix") || undefined;

    const result = await queryBomDetails({
      searchTerm: search,
      designPrefix: prefix,
      limit: 1000,
    });

    const { auditedLines } = await auditBomRows(result.rows);

    // Map each line to the exact 11 requested columns
    const formatLine = (l: (typeof auditedLines)[0]) => ({
      "BOM No": l.bomNo || "",
      "Item No.": l.itemNo || "",
      "Matching Code": l.matchingCode || "",
      "Quality": l.quality || "",
      "Design": l.design || "",
      "GR Color Code": l.grColorCode || "",
      "BR Color Code": l.brColorCode || "",
      "Size": l.size || "",
      "Shape": l.shape || "",
      "Error": l.error || "None",
      "Remarks": l.remarks || "",
    });

    // Sheet 1: Flagged Discrepancies
    const discrepancyData = auditedLines
      .filter((l) => l.status !== "VALID")
      .map(formatLine);

    // Sheet 2: All Audited Lines
    const allData = auditedLines.map(formatLine);

    const workbook = XLSX.utils.book_new();

    const discrepancyWs = XLSX.utils.json_to_sheet(
      discrepancyData.length > 0 ? discrepancyData : [{ "Status": "No discrepancies found" }]
    );
    XLSX.utils.book_append_sheet(workbook, discrepancyWs, "Discrepancies");

    const allWs = XLSX.utils.json_to_sheet(allData);
    XLSX.utils.book_append_sheet(workbook, allWs, "All Audited Lines");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="DND_BOM_Audit_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
