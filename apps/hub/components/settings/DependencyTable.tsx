"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Table } from "@jaipur-rugs/ui-kit";
import { EmptyState } from "@/components/shared/EmptyState";

// Shared Hero UI v3 Table chrome (search + Table.* compound structure + empty state) for
// every Settings management screen (Departments/Roles/Apps) — modeled on the Table/search/
// empty-state shape of apps/DND/BOM Checker's BomGroupSetupTable.tsx, minus its pagination
// bar and memory-cache (that exists there for thousands of live ERP rows; these lookup
// tables run a few dozen rows at most, so a plain client-side filter is enough). App-local
// rather than promoted to packages/ui-kit — only Hub needs this today (AGENTS.md Section 4).

export interface DependencyColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DependencyTable<T extends { id: string }>({
  rows,
  columns,
  ariaLabel,
  searchPlaceholder,
  searchKeys,
  emptyMessage,
  renderActions,
}: {
  rows: T[];
  columns: DependencyColumn<T>[];
  ariaLabel: string;
  searchPlaceholder: string;
  searchKeys: (keyof T)[];
  emptyMessage: string;
  renderActions?: (row: T) => ReactNode;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => searchKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(query)));
  }, [rows, search, searchKeys]);

  if (rows.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={searchPlaceholder}
        className="w-full max-w-xs rounded-full border-2 border-border bg-surface px-4 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-hidden focus:border-accent"
      />
      {filtered.length === 0 ? (
        <EmptyState message="No matches for this search." />
      ) : (
        <div className="overflow-x-auto">
          {/* Table's default "primary" variant already draws its own rounded card
              (@heroui/styles' .table-root--primary) — this wrapper used to add a second,
              square-cornered border around it, which showed as flat corners poking out
              past the table's own rounded ones. Just scroll here, no framing of our own. */}
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={ariaLabel} className="min-w-full">
                <Table.Header>
                  {columns.map((column, index) => (
                    <Table.Column key={column.key} id={column.key} isRowHeader={index === 0} className={column.className}>
                      {column.header}
                    </Table.Column>
                  ))}
                  {renderActions ? (
                    <Table.Column id="actions" className="text-right">
                      {""}
                    </Table.Column>
                  ) : null}
                </Table.Header>
                <Table.Body items={filtered}>
                  {(row: T) => (
                    <Table.Row id={row.id} className="border-b border-border last:border-0">
                      {columns.map((column) => (
                        <Table.Cell key={column.key} className={column.className}>
                          {column.render(row)}
                        </Table.Cell>
                      ))}
                      {renderActions ? <Table.Cell className="text-right">{renderActions(row)}</Table.Cell> : null}
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </div>
      )}
    </div>
  );
}
