import { AppShell } from "@/components/app-shell";
import { GroupedTableSkeleton } from "@/components/grouped/GroupedTableSkeleton";

export default function RugBomsLoading() {
  return (
    <AppShell currentTab="rug-boms">
      <div className="flex h-full flex-col gap-3.5 overflow-hidden">
        {/* Title Header */}
        <div className="flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Rug & BOMs</h1>
            <div className="h-6 w-32 rounded-full bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
          </div>
        </div>

        {/* Shimmer Table Area */}
        <div className="min-h-0 flex-1">
          <GroupedTableSkeleton />
        </div>
      </div>
    </AppShell>
  );
}
