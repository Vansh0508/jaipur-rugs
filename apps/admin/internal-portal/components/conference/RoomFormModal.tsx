"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, TextField } from "@jaipur-rugs/ui-kit";
import { createConferenceRoom, updateConferenceRoom } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { ConferenceRoom } from "@/lib/queries/conference";

/**
 * Add room (no `room`) or Edit room (`room` given) — one form, since both take a name and an
 * optional seating capacity. Seeded from `room` once, on mount; callers remount it per open
 * via a changing `key` (same contract as CarFormModal), so a reopened form never shows a
 * previous edit's leftovers.
 */
export function RoomFormModal({ isOpen, onClose, room }: { isOpen: boolean; onClose: () => void; room?: ConferenceRoom }) {
  const router = useRouter();
  const [name, setName] = useState(room?.name ?? "");
  const [capacity, setCapacity] = useState(room?.capacity ? String(room.capacity) : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(room);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedCapacity = capacity.trim();
    const parsedCapacity = trimmedCapacity === "" ? null : Number(trimmedCapacity);
    if (parsedCapacity !== null && (!Number.isInteger(parsedCapacity) || parsedCapacity < 1)) {
      setError("Seating capacity must be a whole number of 1 or more, or left empty.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (room) await updateConferenceRoom(supabase, { roomId: room.id, name, capacity: parsedCapacity });
      else await createConferenceRoom(supabase, { name, capacity: parsedCapacity });
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${isEdit ? "save" : "add"} the room. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[420px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{isEdit ? "Edit conference room" : "Add conference room"}</Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSubmit}>
              <Modal.Body className="flex flex-col gap-4">
                <TextField label="Room name" value={name} onChange={setName} placeholder="e.g. Board Room" isRequired fullWidth />
                <TextField
                  label="Seating capacity (optional)"
                  value={capacity}
                  onChange={setCapacity}
                  type="number"
                  placeholder="Most people it seats"
                  fullWidth
                />
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button type="submit" fullWidth isPending={submitting}>
                  {isEdit ? "Save changes" : "Add room"}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
