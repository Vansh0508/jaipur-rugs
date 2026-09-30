"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@heroui/react";
import { Button } from "@jaipur-rugs/ui-kit";
import { updateConferenceRoom } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { ConferenceRoom } from "@/lib/queries/conference";
import { ActionsMenu, type ActionSection } from "@/components/shared/ActionsMenu";
import { ActionDialog } from "@/components/shared/ActionDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DeactivateIcon, EditIcon, ReactivateIcon } from "@/components/shared/icons";
import { RoomFormModal } from "./RoomFormModal";

// The Rooms tab: the venues people can book — add one, rename or re-size it, remove it, or
// bring a removed one back. "Remove" is a soft-delete (status inactive) because bookings
// keep a foreign key to their room: a removed room disappears from the booking form and the
// timeline but stays on past bookings. conference-room-update refuses to remove a room that
// still has unfinished bookings and says how many; that message is shown here as-is.

export function RoomsManager({ rooms, roomColors }: { rooms: ConferenceRoom[]; roomColors: Map<string, string> }) {
  const router = useRouter();
  const [formRoom, setFormRoom] = useState<ConferenceRoom | "new" | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState<ConferenceRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function openForm(room: ConferenceRoom | "new") {
    setFormKey((k) => k + 1); // remount so the form starts from this room's current values
    setFormRoom(room);
  }

  async function setStatus(room: ConferenceRoom, status: "active" | "inactive") {
    setPending(true);
    try {
      await updateConferenceRoom(getBrowserSupabaseClient(), { roomId: room.id, status });
      setConfirmRemove(null);
      router.refresh();
    } catch (err) {
      setConfirmRemove(null);
      setError(err instanceof Error ? err.message : "Could not update the room.");
    } finally {
      setPending(false);
    }
  }

  const columns: DataTableColumn<ConferenceRoom>[] = [
    {
      id: "name",
      label: "Room",
      isRowHeader: true,
      sortValue: (room) => room.name.toLowerCase(),
      render: (room) => (
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: roomColors.get(room.id) }} />
          <span className="font-medium text-foreground">{room.name}</span>
        </div>
      ),
    },
    {
      id: "capacity",
      label: "Seating capacity",
      sortValue: (room) => room.capacity,
      render: (room) => <span className="text-sm text-muted tabular-nums">{room.capacity ?? "—"}</span>,
    },
    {
      id: "status",
      label: "Status",
      sortValue: (room) => room.status,
      render: (room) => (
        <Chip color={room.status === "active" ? "success" : "default"} size="sm">
          <Chip.Label>{room.status === "active" ? "Active" : "Removed"}</Chip.Label>
        </Chip>
      ),
    },
    {
      id: "actions",
      label: "Actions",
      className: "w-14 text-right",
      render: (room) => {
        const sections: ActionSection[] = [
          { id: "general", items: [{ id: "edit", label: "Edit", icon: EditIcon }] },
          {
            id: "danger",
            items:
              room.status === "active"
                ? [{ id: "remove", label: "Remove room", icon: DeactivateIcon, variant: "danger" }]
                : [{ id: "restore", label: "Restore room", icon: ReactivateIcon, description: "Bookable again" }],
          },
        ];
        return (
          <div className="flex justify-end">
            <ActionsMenu
              ariaLabel={`Actions for ${room.name}`}
              sections={sections}
              isDisabled={pending}
              onAction={(id) => {
                if (id === "edit") openForm(room);
                else if (id === "remove") setConfirmRemove(room);
                else if (id === "restore") void setStatus(room, "active");
              }}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {rooms.filter((r) => r.status === "active").length} active
          {rooms.some((r) => r.status === "inactive") ? `, ${rooms.filter((r) => r.status === "inactive").length} removed` : ""} · removed
          rooms stay on past bookings but can't be booked.
        </p>
        <Button onPress={() => openForm("new")}>Add room</Button>
      </div>

      <DataTable
        ariaLabel="Conference rooms"
        columns={columns}
        rows={rooms}
        getRowId={(room) => room.id}
        emptyMessage="No conference rooms yet — add the first one to start taking bookings."
        initialSort={{ column: "name", direction: "ascending" }}
      />

      <RoomFormModal
        key={formKey}
        isOpen={formRoom !== null}
        onClose={() => setFormRoom(null)}
        room={formRoom && formRoom !== "new" ? formRoom : undefined}
      />
      <ActionDialog
        isOpen={confirmRemove !== null}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        heading={confirmRemove ? `Remove ${confirmRemove.name}?` : ""}
        body="It stays on past bookings but can't be booked any more, and leaves the booking form and timeline. You can restore it later."
        confirmLabel="Remove"
        isPending={pending}
        onConfirm={() => (confirmRemove ? setStatus(confirmRemove, "inactive") : undefined)}
      />
      <ActionDialog
        isOpen={error !== null}
        onOpenChange={(open) => !open && setError(null)}
        heading="Couldn't update the room"
        body={error}
      />
    </div>
  );
}
