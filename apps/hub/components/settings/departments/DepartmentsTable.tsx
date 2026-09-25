"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog, Button } from "@jaipur-rugs/ui-kit";
import { deleteDepartment } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { DependencyTable } from "@/components/settings/DependencyTable";
import { DepartmentFormModal } from "./DepartmentFormModal";
import type { DepartmentRow } from "@/lib/queries/departments";

export function DepartmentsTable({ rows }: { rows: DepartmentRow[] }) {
  const router = useRouter();
  const [formState, setFormState] = useState<{ row: DepartmentRow | null } | null>(null);
  const [deletingRow, setDeletingRow] = useState<DepartmentRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deletingRow) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteDepartment(getBrowserSupabaseClient(), { departmentId: deletingRow.id });
      setDeletingRow(null);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete this department. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onPress={() => setFormState({ row: null })}>Add department</Button>
      </div>

      <DependencyTable
        rows={rows}
        ariaLabel="Departments"
        searchPlaceholder="Search departments…"
        searchKeys={["name", "code"]}
        emptyMessage="No departments yet."
        columns={[
          {
            key: "name",
            header: "Name",
            render: (department) => <span className="font-medium text-foreground">{department.name}</span>,
          },
          { key: "code", header: "Code", render: (department) => department.code },
          {
            key: "parent",
            header: "Parent department",
            render: (department) => department.parentDepartmentName ?? "—",
          },
        ]}
        renderActions={(department) => (
          <div className="flex justify-end gap-2">
            <Button variant="tertiary" size="sm" onPress={() => setFormState({ row: department })}>
              Edit
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              onPress={() => {
                setDeletingRow(department);
                setDeleteError(null);
              }}
            >
              Delete
            </Button>
          </div>
        )}
      />

      <DepartmentFormModal
        isOpen={formState !== null}
        onClose={() => setFormState(null)}
        editingRow={formState?.row ?? null}
        departments={rows}
      />

      <AlertDialog.Root isOpen={deletingRow !== null} onOpenChange={(open) => !open && setDeletingRow(null)}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Header>
                <AlertDialog.Heading>Delete {deletingRow?.name}?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                This can&rsquo;t be undone. A department still referenced by employees or other records can&rsquo;t be
                deleted.
                {deleteError ? <p className="mt-2 text-sm text-danger">{deleteError}</p> : null}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <AlertDialog.CloseTrigger>Cancel</AlertDialog.CloseTrigger>
                <Button variant="danger" onPress={handleDelete} isPending={deleting}>
                  Delete
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog.Root>
    </div>
  );
}
