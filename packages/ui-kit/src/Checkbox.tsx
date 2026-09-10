// Hero UI v3's Checkbox is a compound component (Checkbox.Content, .Control,
// .Indicator) built on react-aria-components' real checkbox primitives — re-exported
// as-is rather than flattened, same as Table.tsx/Modal.tsx/Popover.tsx/Dropdown.tsx.
// First real consumer: OrdersTable.tsx/RugLensTable.tsx's row-selection column, using
// `slot="selection"` — react-aria-components' documented convention for wiring a plain
// Checkbox up to a Table's row/select-all selection state automatically, with no
// isSelected/onChange wiring of our own needed (the same component works as both the
// header's "select all" checkbox and each row's own, based on where it's rendered).
export { Checkbox } from "@heroui/react";
