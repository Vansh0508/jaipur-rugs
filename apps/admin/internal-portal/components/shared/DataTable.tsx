"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Table, type SortDescriptor } from "@jaipur-rugs/ui-kit";

export interface DataTableColumn<T> {
  id: string;
  label: string;
  /** Exactly one column should be the row header (screen readers announce it per row). */
  isRowHeader?: boolean;
  /** Present = sortable by this column. `null` always sorts last, in either direction. */
  sortValue?: (row: T) => string | number | null;
  className?: string;
  render: (row: T) => ReactNode;
}

/**
 * The app's one list table (Cars, Drivers, ...) — the ui-kit Hero UI Table plus the
 * behavior every list here wants: client-side column sorting and whole-row navigation.
 * Each list only declares its columns. Must be rendered from a client component, since
 * columns carry `render` functions (not serializable across the server boundary).
 *
 * Rows navigate via `onAction` + router.push rather than Table.Row's `href`: this app
 * has no React Aria RouterProvider, so `href` would do a full page load.
 */
export function DataTable<T>({
  ariaLabel,
  columns,
  rows,
  getRowId,
  rowHref,
  onRowAction,
  emptyMessage,
  initialSort,
}: {
  ariaLabel: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  rowHref?: (row: T) => string;
  /** Row click / Enter handler, for rows that open something in place (a dialog) rather than navigate. */
  onRowAction?: (row: T) => void;
  emptyMessage: string;
  initialSort?: SortDescriptor;
}) {
  const router = useRouter();
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor | undefined>(initialSort);

  const sortedRows = useMemo(() => {
    const column = columns.find((c) => c.id === sortDescriptor?.column);
    if (!column?.sortValue) return rows;
    const direction = sortDescriptor?.direction === "descending" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const first = column.sortValue!(a);
      const second = column.sortValue!(b);
      if (first === second) return 0;
      if (first === null) return 1;
      if (second === null) return -1;
      const cmp = typeof first === "number" && typeof second === "number" ? first - second : String(first).localeCompare(String(second));
      return cmp * direction;
    });
  }, [rows, columns, sortDescriptor]);

  return (
    // Primary variant (gray container) by design — not driver-app-new's flat "secondary".
    <Table variant="primary">
      <Table.ScrollContainer>
        <Table.Content
          aria-label={ariaLabel}
          className="min-w-[640px]"
          sortDescriptor={sortDescriptor}
          onSortChange={setSortDescriptor}
        >
          <Table.Header>
            {columns.map((column) => (
              <Table.Column
                key={column.id}
                id={column.id}
                isRowHeader={column.isRowHeader}
                allowsSorting={Boolean(column.sortValue)}
                className={column.className}
              >
                {({ sortDirection }) =>
                  column.sortValue ? (
                    <Table.SortableColumnHeader sortDirection={sortDirection}>{column.label}</Table.SortableColumnHeader>
                  ) : (
                    column.label
                  )
                }
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body renderEmptyState={() => <p className="py-10 text-center text-sm text-muted">{emptyMessage}</p>}>
            {sortedRows.map((row) => {
              const href = rowHref?.(row);
              const action = href ? () => router.push(href) : onRowAction ? () => onRowAction(row) : undefined;
              return (
                <Table.Row
                  key={getRowId(row)}
                  id={getRowId(row)}
                  onAction={action}
                  className={action ? "cursor-pointer" : undefined}
                >
                  {columns.map((column) => (
                    <Table.Cell key={column.id} className={column.className}>
                      {column.render(row)}
                    </Table.Cell>
                  ))}
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
