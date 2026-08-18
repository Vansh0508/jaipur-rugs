"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs } from "@heroui/react";
import { DateRangeField } from "@jaipur-rugs/ui-kit";

const TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
];

// Filter state lives in the URL (?tab=&from=&to=), not client state — the actual list
// page stays a Server Component doing the real fetch, and the URL stays shareable.
export function JourneyFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = searchParams.get("tab") ?? "all";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
      <Tabs selectedKey={tab} onSelectionChange={(key) => pushParams({ tab: String(key) === "all" ? null : String(key) })}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Journey status">
            {TABS.map((t) => (
              <Tabs.Tab key={t.id} id={t.id}>
                {t.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <DateRangeField
        value={{ start: from, end: to }}
        onChange={(range) => pushParams({ from: range.start || null, to: range.end || null })}
      />
    </div>
  );
}
