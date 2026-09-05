// Hero UI v3's Table is a compound component (Table.ScrollContainer, Table.Content,
// Table.Header, Table.Column, Table.Body, Table.Row, Table.Cell, Table.Footer, ...) —
// re-exported as-is rather than flattened, same as Modal.tsx, since consumers need the
// full compound structure to render one. First real consumer: apps/atlas's Orders list
// (needed a properly frozen header while scrolling a long result list — Table.Header's
// own sticky-within-Table.ScrollContainer support, not a hand-rolled position:sticky
// offset hack, which turned out fragile in practice).
export { Table, type SortDescriptor } from "@heroui/react";
