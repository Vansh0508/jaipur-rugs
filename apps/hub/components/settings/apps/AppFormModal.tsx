"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Modal, TextField } from "@jaipur-rugs/ui-kit";
import { createApp, updateApp } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { AppEntry } from "@/lib/queries/apps";

// One modal for both add and edit — an app registry entry's create and edit field sets
// are identical.
export function AppFormModal({
  isOpen,
  onClose,
  editingRow,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingRow: AppEntry | null;
}) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setKey(editingRow?.key ?? "");
    setName(editingRow?.name ?? "");
    setDescription(editingRow?.description ?? "");
    setIsActive(editingRow?.is_active ?? true);
    setError(null);
  }, [isOpen, editingRow]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (editingRow) {
        await updateApp(supabase, { appId: editingRow.id, key, name, description, isActive });
      } else {
        await createApp(supabase, { key, name, description, isActive });
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this app. Please try again.");
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
              <Modal.Heading>{editingRow ? `Edit ${editingRow.name}` : "Add app"}</Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSubmit}>
              <Modal.Body className="flex flex-col gap-4">
                <TextField
                  label="Key"
                  value={key}
                  onChange={setKey}
                  placeholder="e.g. feedback-app"
                  isRequired
                  fullWidth
                />
                <TextField label="Name" value={name} onChange={setName} isRequired fullWidth />
                <TextField label="Description" value={description} onChange={setDescription} fullWidth />
                <label className="flex items-center gap-2.5 text-sm text-foreground select-none cursor-pointer">
                  <Checkbox isSelected={isActive} onChange={setIsActive} aria-label="Active">
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                  <span>Active</span>
                </label>
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button type="submit" fullWidth isPending={submitting}>
                  {editingRow ? "Save changes" : "Add app"}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
