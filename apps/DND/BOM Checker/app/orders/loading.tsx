import { AppShell } from "@/components/app-shell";
import { OrdersTableSkeleton } from "@/components/orders/OrdersTableSkeleton";

export default function OrdersLoading() {
  return (
    <AppShell currentTab="orders">
      <div className="flex h-full flex-col gap-3.5 overflow-hidden">
        {/* Title Header */}
        <div className="flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Orders</h1>
            <div className="h-6 w-24 rounded-full bg-stone-200/70 animate-pulse" />
          </div>
          <div className="h-8 w-28 rounded-lg bg-stone-200/70 animate-pulse" />
        </div>

        {/* Shimmer Table Area */}
        <div className="min-h-0 flex-1">
          <OrdersTableSkeleton />
        </div>
      </div>
    </AppShell>
  );
}
