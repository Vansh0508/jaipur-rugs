"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@heroui/react";
import { AlertDialog, Button } from "@jaipur-rugs/ui-kit";
import { deleteRole } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { DependencyTable } from "@/components/settings/DependencyTable";
import { RoleFormModal } from "./RoleFormModal";
import type { Role } from "@/lib/queries/roles";

export function RolesTable({ rows }: { rows: Role[] }) {
  const router = useRouter();
  const [formState, setFormState] = useState<{ row: Role | null } | null>(null);
  const [deletingRow, setDeletingRow] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deletingRow) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteRole(getBrowserSupabaseClient(), { roleId: deletingRow.id });
      setDeletingRow(null);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete this role. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onPress={() => setFormState({ row: null })}>Add role</Button>
      </div>

      <DependencyTable
        rows={rows}
        ariaLabel="Roles"
        searchPlaceholder="Search roles…"
        searchKeys={["name", "description"]}
        emptyMessage="No roles yet."
        columns={[
          { key: "name", header: "Name", render: (role) => <span className="font-medium text-foreground">{role.name}</span> },
          { key: "description", header: "Description", render: (role) => role.description ?? "—" },
          {
            key: "isGlobal",
            header: "Scope",
            render: (role) => (
              <Chip color={role.is_global ? "accent" : "default"} size="sm">
                <Chip.Label>{role.is_global ? "Global" : "Scoped"}</Chip.Label>
              </Chip>
            ),
          },
        ]}
        renderActions={(role) => (
          <div className="flex justify-end gap-2">
            <Button variant="tertiary" size="sm" onPress={() => setFormState({ row: role })}>
              Edit
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              onPress={() => {
                setDeletingRow(role);
                setDeleteError(null);
              }}
            >
              Delete
            </Button>
          </div>
        )}
      />

      <RoleFormModal isOpen={formState !== null} onClose={() => setFormState(null)} editingRow={formState?.row ?? null} />

      <AlertDialog.Root isOpen={deletingRow !== null} onOpenChange={(open) => !open && setDeletingRow(null)}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Header>
                <AlertDialog.Heading>Delete {deletingRow?.name}?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                This can&rsquo;t be undone. A role still assigned to employees or bound to permissions can&rsquo;t be
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
