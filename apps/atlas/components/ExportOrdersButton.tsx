"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@jaipur-rugs/ui-kit";
import type { OrderRow, StageRow } from "@/lib/queries/orders";

// Excel export — parity with the old tool's one clearly-used feature (build prompt
// Section 7, Phase 1 scope). Same underlying library (SheetJS/xlsx) the old tool used
// via a CDN script tag; here it's a real npm dependency instead.
export function ExportOrdersButton({ rows, stages }: { rows: OrderRow[]; stages: StageRow[] }) {
  const [exporting, setExporting] = useState(false);
  const stageNameById = new Map(stages.map((s) => [s.id, s.display_name]));

  function handleExport() {
    setExporting(true);
    try {
      const exportRows = rows.map((r) => ({
        "OTN No.": r.otn_no,
        "Item No.": r.item_no,
        "Sales Order No.": r.sales_order_no,
        "Customer No.": r.customer_no,
        "Merchant Name": r.merchant_name,
        Stage: r.stage_id ? stageNameById.get(r.stage_id) ?? "" : "",
        "Current Status (ERP)": r.raw_current_status,
        "Days in Current Status": r.current_status_pending_days,
        Quality: r.quality,
        Design: r.design,
        Size: r.size,
        "Sales Order Date": r.sales_order_date,
        "Promised Delivery Date": r.promised_delivery_date,
        "Follow Up Person": r.follow_up_person,
        "Salesperson Code": r.salesperson_code,
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
      XLSX.writeFile(workbook, `atlas-orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button variant="tertiary" size="sm" onPress={handleExport} isPending={exporting} isDisabled={!rows.length}>
      Export to Excel
    </Button>
  );
}
