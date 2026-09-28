"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateDriverStatus, type UpdateDriverStatusInput } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { DriverListItem } from "@/lib/queries/drivers";
import { ActionsMenu, type ActionSection } from "@/components/shared/ActionsMenu";
import { ActionDialog } from "@/components/shared/ActionDialog";
import {
  AvailableIcon,
  DeactivateIcon,
  EditIcon,
  LeaveIcon,
  ReactivateIcon,
  SuspendIcon,
  ViewIcon,
} from "@/components/shared/icons";
import { DriverFormModal } from "./DriverFormModal";

type SettableStatus = UpdateDriverStatusInput["status"];

const STATUS_ACTIONS: { status: Exclude<SettableStatus, "inactive">; label: string; icon: typeof AvailableIcon }[] = [
  { status: "active", label: "Mark available", icon: AvailableIcon },
  { status: "on_leave", label: "Mark on leave", icon: LeaveIcon },
  { status: "suspended", label: "Suspend", icon: SuspendIcon },
];

// driver-app-new's DriversTable ⋮ menu (Edit / Mark on leave / Suspend / Mark available /
// Delete), on real Edge Functions: update-driver-status and update-driver, "Delete" as a
// soft-delete to `inactive`. Same contract as CarActionsMenu — disabled states mirror the
// server-side guards, which remain the real enforcement.
export function DriverActionsMenu({ driver }: { driver: DriverListItem }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [confirm, setConfirm] = useState<"suspended" | "inactive" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onTrip = driver.displayStatus === "on_trip";
  const isInactive = driver.status === "inactive";
  const onTripNote = onTrip ? "On a journey right now" : undefined;

  async function setStatus(status: SettableStatus) {
    setPending(true);
    try {
      await updateDriverStatus(getBrowserSupabaseClient(), { driverId: driver.id, status });
      setConfirm(null);
      router.refresh();
    } catch (err) {
      setConfirm(null);
      setError(err instanceof Error ? err.message : "Could not update the driver's status.");
    } finally {
      setPending(false);
    }
  }

  const sections: ActionSection[] = [
    {
      id: "general",
      items: [
        { id: "view", label: "View details", icon: ViewIcon },
        { id: "edit", label: "Edit", icon: EditIcon },
      ],
    },
    {
      id: "status",
      title: "Status",
      items: isInactive
        ? []
        : STATUS_ACTIONS.map(({ status, label, icon }) => ({
            id: `status:${status}`,
            label,
            icon,
            // Going back to available is always allowed; anything else is blocked mid-trip.
            isDisabled: driver.status === status || (onTrip && status !== "active"),
            description: status !== "active" ? onTripNote : undefined,
          })),
    },
    {
      id: "danger",
      items: isInactive
        ? [{ id: "reactivate", label: "Reactivate", icon: ReactivateIcon, description: "Back on the roster as available" }]
        : [{ id: "deactivate", label: "Deactivate", icon: DeactivateIcon, variant: "danger", isDisabled: onTrip, description: onTripNote }],
    },
  ];

  function handleAction(id: string) {
    if (id === "view") router.push(`/drivers/${driver.id}`);
    else if (id === "edit") {
      setEditKey((k) => k + 1);
      setEditOpen(true);
    } else if (id === "deactivate") setConfirm("inactive");
    else if (id === "reactivate") void setStatus("active");
    else if (id === "status:suspended") setConfirm("suspended");
    else if (id.startsWith("status:")) void setStatus(id.slice("status:".length) as SettableStatus);
  }

  return (
    <>
      <ActionsMenu ariaLabel={`Actions for ${driver.full_name}`} sections={sections} onAction={handleAction} isDisabled={pending} />
      <DriverFormModal key={editKey} isOpen={editOpen} onClose={() => setEditOpen(false)} driver={driver} />
      <ActionDialog
        isOpen={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        heading={confirm === "inactive" ? `Deactivate ${driver.full_name}?` : `Suspend ${driver.full_name}?`}
        body={
          confirm === "inactive"
            ? "They stay in the list (and in past journeys and reviews) but can't be assigned new journeys, and disappear from the guest rating page. You can reactivate them later."
            : "They can't be assigned new journeys and disappear from the guest rating page until marked available again."
        }
        confirmLabel={confirm === "inactive" ? "Deactivate" : "Suspend"}
        isPending={pending}
        onConfirm={() => (confirm ? setStatus(confirm) : undefined)}
      />
      <ActionDialog
        isOpen={error !== null}
        onOpenChange={(open) => !open && setError(null)}
        heading="Couldn't update the driver"
        body={error}
      />
    </>
  );
}
