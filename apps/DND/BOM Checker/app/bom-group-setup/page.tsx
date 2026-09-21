import React from "react";
import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { BomGroupSetupTable } from "@/components/bom-group-setup/BomGroupSetupTable";
import { fetchBomGroupSetupRecords } from "@/lib/queries/bom-group-setup";

export const metadata: Metadata = {
  title: "BOM Group Item Setup | BOM Checker",
  description:
    "Live ERP Report View [dbo].[Production BOM Group Item No Setup] from Microsoft Dynamics NAV.",
};

export const dynamic = "force-dynamic";

export default async function BomGroupSetupPage() {
  const initialData = await fetchBomGroupSetupRecords({ page: 1, pageSize: 20 });

  return (
    <AppShell
      currentTab="bom-group-setup"
      userEmail="auditor@jaipurrugs.com"
      userName="D&D Auditor"
      userRole="BOM Auditor"
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <BomGroupSetupTable
          initialRecords={initialData.records}
          initialTotalCount={initialData.totalCount}
          initialPage={initialData.page}
          initialPageSize={initialData.pageSize}
        />
      </div>
    </AppShell>
  );
}
