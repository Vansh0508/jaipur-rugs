import {
  listOrders,
  listOrderFacets,
  listStages,
  listFollowUpPersonEmails,
  DEFAULT_PAGE_SIZE,
  type OrderFilters,
  type AgingBucket,
  type DelayStatusFilter,
  type ConstructionType,
  type SortableColumn,
} from "@/lib/queries/orders";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { OrdersTable } from "@/components/orders/OrdersTable";
import { ExportOrdersButton } from "@/components/orders/ExportOrdersButton";
import { StageChip } from "@/components/orders/StageChip";
import { AppShell } from "@/components/app-shell";

type SearchParams = Record<string, string | string[] | undefined>;

function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await getServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [stages, facets, followUpPersonEmails] = await Promise.all([
    listStages(supabase),
    listOrderFacets(supabase),
    listFollowUpPersonEmails(supabase),
  ]);
  const terminalStageIds = stages.filter((s) => s.is_terminal).map((s) => s.id);

  const pageSize = Number(toSingle(params.pageSize)) || DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(toSingle(params.page)) || 1);
  const sortBy = toSingle(params.sortBy) as SortableColumn | undefined;
  const sortDir = (toSingle(params.sortDir) as "asc" | "desc" | undefined) ?? "desc";

  const filters: OrderFilters = {
    search: toSingle(params.q),
    stageId: toArray(params.stageId),
    customerNo: toArray(params.customerNo),
    merchantName: toArray(params.merchantName),
    orderWiseMerchant: toArray(params.orderWiseMerchant),
    followUpPerson: toArray(params.followUpPerson),
    customerPoNo: toArray(params.customerPoNo),
    quality: toArray(params.quality),
    design: toArray(params.design),
    size: toArray(params.size),
    productionOrderStatus: toArray(params.productionOrderStatus),
    priority: toArray(params.priority),
    aging: toSingle(params.aging) as AgingBucket | undefined,
    onHold: toSingle(params.onHold) as "yes" | "no" | undefined,
    quickShip: toSingle(params.quickShip) as "yes" | "no" | undefined,
    delayStatus: toSingle(params.delayStatus) as DelayStatusFilter | undefined,
    terminalStageIds,
    dueFrom: toSingle(params.dueFrom),
    dueTo: toSingle(params.dueTo),
    ctype: toSingle(params.ctype) as ConstructionType | undefined,
    page,
    pageSize,
    sortBy,
    sortDir,
  };

  const { rows: orders, totalCount } = await listOrders(supabase, filters);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasAnyFilter = Object.entries(params).some(
    ([k, v]) => !["page", "pageSize", "sortBy", "sortDir"].includes(k) && v,
  );

  return (
    <AppShell
      currentTab="orders"
      userEmail={user?.email || "auditor@jaipurrugs.com"}
      userName={user?.user_metadata?.full_name || user?.email?.split("@")[0] || "D&D Auditor"}
      userRole="Auditor"
    >
      <div className="flex h-full flex-col gap-3.5 overflow-hidden">
        <div className="flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Orders</h1>
            {toArray(params.stageId).length === 1 ? (
              (() => {
                const stage = stages.find((s) => s.id === toArray(params.stageId)[0]);
                return stage ? <StageChip code={stage.code} label={`Filtered: ${stage.display_name}`} /> : null;
              })()
            ) : null}
          </div>
          <ExportOrdersButton rows={orders} stages={stages} />
        </div>

        <div className="min-h-0 flex-1">
          <OrdersTable
            rows={orders}
            stages={stages}
            facets={facets}
            values={{
              q: (params.q as string | undefined) ?? "",
              stageId: toArray(params.stageId),
              customerNo: toArray(params.customerNo),
              merchantName: toArray(params.merchantName),
              orderWiseMerchant: toArray(params.orderWiseMerchant),
              followUpPerson: toArray(params.followUpPerson),
              customerPoNo: toArray(params.customerPoNo),
              quality: toArray(params.quality),
              design: toArray(params.design),
              size: toArray(params.size),
              productionOrderStatus: toArray(params.productionOrderStatus),
              priority: toArray(params.priority),
              aging: toSingle(params.aging),
              onHold: toSingle(params.onHold),
              quickShip: toSingle(params.quickShip),
              delayStatus: toSingle(params.delayStatus),
              ctype: toSingle(params.ctype),
              dueFrom: toSingle(params.dueFrom),
              dueTo: toSingle(params.dueTo),
            }}
            hasAnyFilter={hasAnyFilter}
            followUpPersonEmails={followUpPersonEmails}
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
          />
        </div>
      </div>
    </AppShell>
  );
}
