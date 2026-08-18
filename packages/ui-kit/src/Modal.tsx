// Hero UI v3's Modal is a compound component (Modal.Backdrop, Modal.Container, Modal.Dialog,
// Modal.Header, Modal.Body, Modal.Footer, Modal.CloseTrigger, ...) — re-exported as-is
// rather than flattened, since consumers need the full compound structure to render one.
export { Modal, useOverlayState } from "@heroui/react";
