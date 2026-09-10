// Hero UI v3's Popover is a compound component (Popover.Root, Popover.Trigger,
// Popover.Content, Popover.Dialog, Popover.Heading, Popover.Arrow) — re-exported as-is
// rather than flattened, same as Table.tsx/Modal.tsx, since consumers need the full
// compound structure to render one. First real consumer: apps/atlas's sidebar profile
// menu (click-to-open, not the old hover-reveal panel).
export { Popover } from "@heroui/react";
