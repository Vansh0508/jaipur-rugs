"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@jaipur-rugs/ui-kit";
import { completeJourney } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { ActionDialog } from "@/components/shared/ActionDialog";

// driver-app-new's MarkEndedButton: confirm, then end the journey. Backed by
// complete-journey, which also frees the car and driver from now on when ending early.
export function MarkEndedButton({
  journeyId,
  size = "md",
  fullWidth,
}: {
  journeyId: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    try {
      await completeJourney(getBrowserSupabaseClient(), { journeyId });
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      setConfirmOpen(false);
      setError(err instanceof Error ? err.message : "Could not end the journey.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        fullWidth={fullWidth}
        className="border-warning/40 font-medium text-warning hover:bg-warning/5"
        onPress={() => setConfirmOpen(true)}
      >
        Mark ended
      </Button>
      <ActionDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        heading="Mark journey as ended?"
        body="This frees up the car and driver from now on. This action cannot be undone."
        confirmLabel="Mark ended"
        isPending={pending}
        onConfirm={confirm}
      />
      <ActionDialog
        isOpen={error !== null}
        onOpenChange={(open) => !open && setError(null)}
        heading="Couldn't end the journey"
        body={error}
      />
    </>
  );
}
