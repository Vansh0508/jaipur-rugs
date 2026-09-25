"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Select, TextField } from "@jaipur-rugs/ui-kit";
import { createDepartment, updateDepartment } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { DepartmentRow } from "@/lib/queries/departments";

// One modal for both add and edit — unlike the Team page's Add/EditEmployeeModal split,
// a department's create and edit field sets are identical, so splitting them would just be
// duplication.
export function DepartmentFormModal({
  isOpen,
  onClose,
  editingRow,
  departments,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingRow: DepartmentRow | null;
  departments: Pick<DepartmentRow, "id" | "name">[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentDepartmentId, setParentDepartmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The Modal stays mounted across opens (only `editingRow` swaps), so fields are reset
  // here rather than via useState initializers, which only run on first mount.
  useEffect(() => {
    if (!isOpen) return;
    setName(editingRow?.name ?? "");
    setCode(editingRow?.code ?? "");
    setParentDepartmentId(editingRow?.parent_department_id ?? null);
    setError(null);
  }, [isOpen, editingRow]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (editingRow) {
        await updateDepartment(supabase, {
          departmentId: editingRow.id,
          name,
          code,
          parentDepartmentId,
        });
      } else {
        await createDepartment(supabase, {
          name,
          code,
          parentDepartmentId: parentDepartmentId ?? undefined,
        });
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this department. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const parentOptions = departments.filter((d) => d.id !== editingRow?.id);

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[420px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{editingRow ? `Edit ${editingRow.name}` : "Add department"}</Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSubmit}>
              <Modal.Body className="flex flex-col gap-4">
                <TextField label="Name" value={name} onChange={setName} isRequired fullWidth />
                <TextField label="Code" value={code} onChange={setCode} isRequired fullWidth />
                <Select
                  label="Parent department"
                  items={parentOptions.map((d) => ({ id: d.id, label: d.name }))}
                  value={parentDepartmentId}
                  onChange={setParentDepartmentId}
                  placeholder="No parent"
                  fullWidth
                />
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button type="submit" fullWidth isPending={submitting}>
                  {editingRow ? "Save changes" : "Add department"}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
