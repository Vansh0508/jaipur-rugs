"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@heroui/react";
import { Button } from "@jaipur-rugs/ui-kit";
import { cancelJourney } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

export function CancelJourneyButton({ journeyId }: { journeyId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleConfirm() {
    setIsPending(true);
    await cancelJourney(getBrowserSupabaseClient(), { journeyId });
    router.refresh();
    setIsPending(false);
  }

  return (
    <AlertDialog>
      <AlertDialog.Trigger>
        <Button variant="danger" size="sm">
          Cancel journey
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            {({ close }) => (
              <>
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>Cancel this journey?</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>This frees the assigned car and driver for other journeys.</AlertDialog.Body>
                <AlertDialog.Footer>
                  {/* Plain Buttons + the render-prop `close()`, not AlertDialog.CloseTrigger — wrapping
                      a <Button> in CloseTrigger nests <button><button>, invalid HTML that broke hydration. */}
                  <Button variant="secondary" onPress={close}>
                    Keep it
                  </Button>
                  <Button
                    variant="danger"
                    isPending={isPending}
                    onPress={async () => {
                      await handleConfirm();
                      close();
                    }}
                  >
                    Cancel journey
                  </Button>
                </AlertDialog.Footer>
              </>
            )}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
