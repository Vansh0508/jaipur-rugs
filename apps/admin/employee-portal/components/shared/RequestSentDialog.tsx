"use client";

import { AlertDialog, Button } from "@jaipur-rugs/ui-kit";

/** Shown once a request is in: it's waiting for an admin, nothing is booked yet. */
export function RequestSentDialog({
  isOpen,
  onClose,
  heading,
  body,
  reference,
}: {
  isOpen: boolean;
  onClose: () => void;
  heading: string;
  body: string;
  /** The request id, shortened, so the employee can quote it to the admin team. */
  reference: string | null;
}) {
  return (
    <AlertDialog.Root isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            {({ close }) => (
              <>
                <AlertDialog.Icon status="success" />
                <AlertDialog.Header>
                  <AlertDialog.Heading>{heading}</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>{body}</p>
                  {reference ? (
                    <p className="mt-2 text-xs text-muted">
                      Reference: <span className="font-semibold tabular-nums text-foreground">{reference.slice(0, 8).toUpperCase()}</span>
                    </p>
                  ) : null}
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button onPress={close}>Done</Button>
                </AlertDialog.Footer>
              </>
            )}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog.Root>
  );
}
