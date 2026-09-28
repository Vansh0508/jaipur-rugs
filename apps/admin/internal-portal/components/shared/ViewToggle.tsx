"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@heroui/react";
import type { ListView } from "@/lib/listView";
import { CardViewIcon, TableViewIcon } from "./icons";

const VIEWS: { id: ListView; label: string; icon: (props: { className?: string }) => React.ReactElement }[] = [
  { id: "table", label: "Table view", icon: TableViewIcon },
  { id: "cards", label: "Card view", icon: CardViewIcon },
];

// Icon-only Hero UI Tabs switching a list page between table and card view. The choice
// lives in the URL (?view=cards), same as JourneyFilters' ?tab= — the page stays a Server
// Component that renders the right view on first paint (no localStorage flash of the
// wrong view), and a link to "the cards view" is shareable. `replace`, not `push`:
// flipping views shouldn't pile up Back-button history.
export function ViewToggle({ view }: { view: ListView }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(next: ListView) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "table") params.delete("view");
    else params.set("view", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Tabs selectedKey={view} onSelectionChange={(key) => handleChange(String(key) as ListView)}>
      <Tabs.ListContainer>
        <Tabs.List aria-label="View">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <Tabs.Tab key={id} id={id} aria-label={label} className="px-2.5">
              <span title={label} className="flex items-center">
                <Icon className="h-4 w-4" />
              </span>
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}
