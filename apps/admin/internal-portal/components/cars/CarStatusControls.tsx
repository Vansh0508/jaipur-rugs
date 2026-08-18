"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@heroui/react";
import { Button } from "@jaipur-rugs/ui-kit";
import { updateCarStatus } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { Enums } from "@jaipur-rugs/supabase-client";

// A status change affects live availability calculations for every in-progress journey
// plan, so each action sits behind an AlertDialog confirm — same pattern as
// CancelJourneyButton.
export function CarStatusControls({ vehicleId, status }: { vehicleId: string; status: Enums<"vehicle_status"> }) {
  return (
    <div className="flex gap-2">
      {status !== "vacant" ? <StatusButton vehicleId={vehicleId} target="vacant" label="Mark vacant" /> : null}
      {status !== "maintenance" ? <StatusButton vehicleId={vehicleId} target="maintenance" label="Send for maintenance" /> : null}
    </div>
  );
}

function StatusButton({
  vehicleId,
  target,
  label,
}: {
  vehicleId: string;
  target: "vacant" | "maintenance";
  label: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setIsPending(true);
    setError(null);
    try {
      await updateCarStatus(getBrowserSupabaseClient(), { vehicleId, status: target });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialog.Trigger>
        <Button variant="secondary" size="sm">
          {label}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            {({ close }) => (
              <>
                <AlertDialog.Header>
                  <AlertDialog.Heading>{label}?</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  This affects availability for any journey being planned right now.
                  {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  {/* Plain Buttons + the render-prop `close()`, not AlertDialog.CloseTrigger — wrapping
                      a <Button> in CloseTrigger nests <button><button>, invalid HTML that broke hydration. */}
                  <Button variant="secondary" onPress={close}>
                    Not now
                  </Button>
                  <Button
                    isPending={isPending}
                    onPress={async () => {
                      await handleConfirm();
                      close();
                    }}
                  >
                    Confirm
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
