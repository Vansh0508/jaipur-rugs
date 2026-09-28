"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCarStatus, type UpdateCarStatusInput } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { CarListItem } from "@/lib/queries/cars";
import { ActionsMenu, type ActionSection } from "@/components/shared/ActionsMenu";
import { ActionDialog } from "@/components/shared/ActionDialog";
import {
  AccidentIcon,
  AvailableIcon,
  DeactivateIcon,
  EditIcon,
  MaintenanceIcon,
  ReactivateIcon,
  ViewIcon,
} from "@/components/shared/icons";
import { CarFormModal } from "./CarFormModal";

type SettableStatus = UpdateCarStatusInput["status"];

const STATUS_ACTIONS: { status: Exclude<SettableStatus, "inactive">; label: string; icon: typeof AvailableIcon }[] = [
  { status: "vacant", label: "Mark vacant", icon: AvailableIcon },
  { status: "maintenance", label: "Send for maintenance", icon: MaintenanceIcon },
  { status: "accidental", label: "Mark accidental", icon: AccidentIcon },
];

// driver-app-new's CarCard ⋮ menu (View / Edit / Status / Delete), on real Edge
// Functions: status via update-car-status, edit via update-car, and "Delete" as a
// soft-delete to `inactive` (journeys/feedback keep FKs to the car, so it's never a hard
// delete). update-car-status re-checks every guard server-side; the disabled states here
// are only so the menu doesn't offer what the server would refuse.
export function CarActionsMenu({ car }: { car: CarListItem }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onTrip = car.displayStatus === "on_trip";
  const isInactive = car.status === "inactive";
  const onTripNote = onTrip ? "On a journey right now" : undefined;

  async function setStatus(status: SettableStatus) {
    setPending(true);
    try {
      await updateCarStatus(getBrowserSupabaseClient(), { vehicleId: car.id, status });
      setConfirmDeactivate(false);
      router.refresh();
    } catch (err) {
      setConfirmDeactivate(false);
      setError(err instanceof Error ? err.message : "Could not update the car's status.");
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
            isDisabled: onTrip || car.status === status,
            description: onTripNote,
          })),
    },
    {
      id: "danger",
      items: isInactive
        ? [{ id: "reactivate", label: "Reactivate", icon: ReactivateIcon, description: "Back in the fleet as vacant" }]
        : [{ id: "deactivate", label: "Deactivate", icon: DeactivateIcon, variant: "danger", isDisabled: onTrip, description: onTripNote }],
    },
  ];

  function handleAction(id: string) {
    if (id === "view") router.push(`/cars/${car.id}`);
    else if (id === "edit") {
      setEditKey((k) => k + 1);
      setEditOpen(true);
    } else if (id === "deactivate") setConfirmDeactivate(true);
    else if (id === "reactivate") void setStatus("vacant");
    else if (id.startsWith("status:")) void setStatus(id.slice("status:".length) as SettableStatus);
  }

  return (
    <>
      <ActionsMenu ariaLabel={`Actions for ${car.name}`} sections={sections} onAction={handleAction} isDisabled={pending} />
      <CarFormModal key={editKey} isOpen={editOpen} onClose={() => setEditOpen(false)} car={car} />
      <ActionDialog
        isOpen={confirmDeactivate}
        onOpenChange={setConfirmDeactivate}
        heading={`Deactivate ${car.name}?`}
        body="It stays in the list (and in past journeys) but can't be booked for new journeys. You can reactivate it later."
        confirmLabel="Deactivate"
        isPending={pending}
        onConfirm={() => setStatus("inactive")}
      />
      <ActionDialog
        isOpen={error !== null}
        onOpenChange={(open) => !open && setError(null)}
        heading="Couldn't update the car"
        body={error}
      />
    </>
  );
}
