"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Modal, TextField } from "@jaipur-rugs/ui-kit";
import { createRole, updateRole } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { Role } from "@/lib/queries/roles";

// One modal for both add and edit — a role's create and edit field sets are identical.
export function RoleFormModal({
  isOpen,
  onClose,
  editingRow,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingRow: Role | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isGlobal, setIsGlobal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(editingRow?.name ?? "");
    setDescription(editingRow?.description ?? "");
    setIsGlobal(editingRow?.is_global ?? false);
    setError(null);
  }, [isOpen, editingRow]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (editingRow) {
        await updateRole(supabase, { roleId: editingRow.id, name, description, isGlobal });
      } else {
        await createRole(supabase, { name, description, isGlobal });
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this role. Please try again.");
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
              <Modal.Heading>{editingRow ? `Edit ${editingRow.name}` : "Add role"}</Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSubmit}>
              <Modal.Body className="flex flex-col gap-4">
                <TextField label="Name" value={name} onChange={setName} isRequired fullWidth />
                <TextField label="Description" value={description} onChange={setDescription} fullWidth />
                <label className="flex items-center gap-2.5 text-sm text-foreground select-none cursor-pointer">
                  <Checkbox isSelected={isGlobal} onChange={setIsGlobal} aria-label="Global role">
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                  <span>Global role</span>
                </label>
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button type="submit" fullWidth isPending={submitting}>
                  {editingRow ? "Save changes" : "Add role"}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
