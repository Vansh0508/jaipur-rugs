"use client";

import { Dropdown } from "@jaipur-rugs/ui-kit";

export interface ColumnDef {
  id: string;
  label: string;
}

/** "Columns" show/hide dropdown, shared by OrdersTable.tsx and RugLensTable.tsx — added
 * 2026-09-10. Unlike the filter dropdowns (FilterPrimitives.tsx's FacetDropdown), a
 * column's visibility takes effect immediately per click rather than waiting for the
 * dropdown to close — toggling a column doesn't cost a server round-trip, so there's no
 * reason to batch it. `hidden` is the set of column ids currently hidden; Hero UI's
 * Dropdown wants the OPPOSITE (which keys are "selected," i.e. visible), so this
 * flips between the two at the boundary. */
export function ColumnVisibilityMenu({
  columns,
  hidden,
  onChange,
}: {
  columns: ColumnDef[];
  hidden: Set<string>;
  onChange: (hidden: Set<string>) => void;
}) {
  const visibleKeys = new Set(columns.map((c) => c.id).filter((id) => !hidden.has(id)));

  return (
    <Dropdown.Root>
      <Dropdown.Trigger className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-border px-3 py-1.5 text-sm hover:bg-surface-secondary">
        Columns
      </Dropdown.Trigger>
      <Dropdown.Popover className="w-56">
        <Dropdown.Menu
          aria-label="Columns"
          selectionMode="multiple"
          shouldCloseOnSelect={false}
          selectedKeys={visibleKeys}
          onSelectionChange={(keys) => {
            const nextVisible = keys === "all" ? new Set(columns.map((c) => c.id)) : new Set([...keys].map(String));
            onChange(new Set(columns.map((c) => c.id).filter((id) => !nextVisible.has(id))));
          }}
          className="flex max-h-72 flex-col gap-0.5 overflow-y-auto p-2"
          items={columns}
        >
          {(item: ColumnDef) => (
            <Dropdown.Item id={item.id} textValue={item.label} className="flex items-center gap-2 px-1.5 py-1 text-xs">
              <Dropdown.ItemIndicator type="checkmark" />
              <span className="truncate">{item.label}</span>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}
