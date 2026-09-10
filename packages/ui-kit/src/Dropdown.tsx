// Hero UI v3's Dropdown is a compound component (Dropdown.Root, .Trigger, .Popover,
// .Menu, .Item, .ItemIndicator, .Section, ...) — re-exported as-is rather than
// flattened, same as Table.tsx/Modal.tsx/Popover.tsx. `.Menu` accepts
// `selectionMode="multiple"` + `selectedKeys`/`onSelectionChange` + `shouldCloseOnSelect`
// (it's a RAC Menu under the hood), which is what makes a real "checkbox-style"
// multi-select filter dropdown possible — `.ItemIndicator` renders the checkmark glyph
// per item based on its selected state. First real consumer: apps/atlas's filter bar
// (relocated off the sidebar, 2026-09-10) and its per-table column-visibility menu.
export { Dropdown } from "@heroui/react";
