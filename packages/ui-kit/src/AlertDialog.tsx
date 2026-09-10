// Hero UI v3's AlertDialog is a compound component (AlertDialog.Root, .Backdrop,
// .Container, .Dialog, .Header, .Heading, .Body, .Footer, .CloseTrigger, .Icon) —
// re-exported as-is rather than flattened, same as Table.tsx/Modal.tsx/Popover.tsx.
// `.Root` accepts a controlled `isOpen`/`onOpenChange` directly (it's a RAC
// DialogTrigger under the hood), so it can be opened programmatically from a button
// inside a Popover rather than needing its own `.Trigger` wrapping a DOM element — the
// exact shape apps/atlas's sign-out confirmation needs (first real consumer).
export { AlertDialog } from "@heroui/react";
