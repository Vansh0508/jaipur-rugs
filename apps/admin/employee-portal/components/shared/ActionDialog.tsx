"use client";

import { AlertDialog, Button } from "@jaipur-rugs/ui-kit";

/**
 * Confirm (with `onConfirm`) or error notice (without) for quick actions — controlled, so
 * it can be opened from a Dropdown item rather than needing its own trigger. Footer uses
 * plain Buttons + the render-prop `close()`, not AlertDialog.CloseTrigger (that renders as
 * the corner × icon — see components/shell/UserMenu.tsx).
 */
export function ActionDialog({
  isOpen,
  onOpenChange,
  heading,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  isPending,
  tone = "danger",
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  heading: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  isPending?: boolean;
  /** "danger" (default) for destructive confirms; "success" for a positive one like Approve. */
  tone?: "danger" | "success";
}) {
  return (
    <AlertDialog.Root isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            {({ close }) => (
              <>
                <AlertDialog.Icon status={tone} />
                <AlertDialog.Header>
                  <AlertDialog.Heading>{heading}</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>{body}</AlertDialog.Body>
                <AlertDialog.Footer>
                  {onConfirm ? (
                    <>
                      <Button variant="secondary" onPress={close}>
                        {cancelLabel ?? "Cancel"}
                      </Button>
                      <Button variant={tone === "danger" ? "danger" : "primary"} isPending={isPending} onPress={onConfirm}>
                        {confirmLabel ?? "Confirm"}
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" onPress={close}>
                      OK
                    </Button>
                  )}
                </AlertDialog.Footer>
              </>
            )}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog.Root>
  );
}
