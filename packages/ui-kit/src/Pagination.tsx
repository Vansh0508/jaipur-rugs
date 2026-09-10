// Hero UI v3's Pagination is a compound, purely presentational component (Pagination.
// Root, .Content, .Item, .Link, .Previous, .Next, .Ellipsis, .Summary) — re-exported as-
// is rather than flattened, same as Table.tsx/Modal.tsx/Popover.tsx. It has no
// currentPage/totalPages/onPageChange prop of its own (confirmed by reading its type
// definitions) — `.Link`/`.Previous`/`.Next` are `onPress`-callback based, not href-
// based, so the consumer wires page state and navigation itself. First real consumer:
// apps/atlas's Orders page (replacing its old plain Prev/Next `<Link>` footer with real
// numbered pages, 2026-09-10).
export { Pagination } from "@heroui/react";
