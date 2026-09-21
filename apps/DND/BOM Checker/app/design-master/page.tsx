import React from "react";
import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { DesignMasterTable } from "@/components/design-master/DesignMasterTable";
import { fetchDesignMasterRecords } from "@/lib/queries/design-master";

export const metadata: Metadata = {
  title: "Design Master | BOM Checker",
  description:
    "Live ERP Design Master records from Microsoft Dynamics NAV [dbo].[JRCPL Live$Design].",
};

export const dynamic = "force-dynamic";

export default async function DesignMasterPage() {
  const initialData = await fetchDesignMasterRecords({ page: 1, pageSize: 20, sortBy: "code" });

  return (
    <AppShell
      currentTab="design-master"
      userEmail="auditor@jaipurrugs.com"
      userName="D&D Auditor"
      userRole="Design Auditor"
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <DesignMasterTable
          initialRecords={initialData.records}
          initialTotalCount={initialData.totalCount}
          initialPage={initialData.page}
          initialPageSize={initialData.pageSize}
        />
      </div>
    </AppShell>
  );
}
