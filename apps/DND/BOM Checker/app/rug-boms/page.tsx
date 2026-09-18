import {
  listOrders,
  listStages,
  DEFAULT_PAGE_SIZE,
  type OrderFilters,
  type SortableColumn,
} from "@/lib/queries/orders";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { AppShell } from "@/components/app-shell";
import { GroupedOrdersBomTable, StageGroupTab } from "@/components/grouped/GroupedOrdersBomTable";

type SearchParams = Record<string, string | string[] | undefined>;

function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RugBomsGroupedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const stages = await listStages(supabase);
  const terminalStageIds = stages.filter((s) => s.is_terminal).map((s) => s.id);

  // Tab: pre_loom (default), loom, after_loom, or all
  const rawTab = toSingle(params.tab);
  const currentTab: StageGroupTab =
    rawTab === "loom" || rawTab === "after_loom" || rawTab === "all"
      ? rawTab
      : "pre_loom";

  // Map category tab to stage IDs
  let stageIds: string[] = [];
  if (currentTab === "pre_loom") {
    stageIds = stages.filter((s) => s.code === "pre_loom").map((s) => s.id);
  } else if (currentTab === "loom") {
    stageIds = stages.filter((s) => s.code === "loom").map((s) => s.id);
  } else if (currentTab === "after_loom") {
    stageIds = stages
      .filter((s) => ["finish", "purchase", "consignee", "delivered"].includes(s.code) || s.display_order > 20)
      .map((s) => s.id);
  }

  const pageSize = Number(toSingle(params.pageSize)) || DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(toSingle(params.page)) || 1);
  const sortBy = (toSingle(params.sortBy) as SortableColumn | undefined) || "salesOrderDate";
  const sortDir = (toSingle(params.sortDir) as "asc" | "desc" | undefined) ?? "desc";
  const searchQuery = toSingle(params.q);

  const filters: OrderFilters = {
    search: searchQuery,
    stageId: stageIds.length > 0 ? stageIds : undefined,
    terminalStageIds,
    page,
    pageSize,
    sortBy,
    sortDir,
  };

  const { rows: orders, totalCount } = await listOrders(supabase, filters);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <AppShell
      currentTab="rug-boms"
      userEmail={user?.email || "auditor@jaipurrugs.com"}
      userName={user?.user_metadata?.full_name || user?.email?.split("@")[0] || "D&D Auditor"}
      userRole="Auditor"
    >
      <div className="flex h-full flex-col gap-3.5 overflow-hidden">
        {/* Page Title Header */}
        <div className="flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Rug & BOMs</h1>
            <span className="rounded-full bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
              Master-Detail Explorer
            </span>
          </div>
        </div>

        {/* Grouped Master-Detail Table */}
        <div className="min-h-0 flex-1">
          <GroupedOrdersBomTable
            rows={orders}
            stages={stages}
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            currentTab={currentTab}
            currentSearch={searchQuery}
            sortBy={sortBy}
            sortDir={sortDir}
          />
        </div>
      </div>
    </AppShell>
  );
}
