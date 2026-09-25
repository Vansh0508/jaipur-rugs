"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@heroui/react";
import { AlertDialog, Button } from "@jaipur-rugs/ui-kit";
import { deleteApp } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { DependencyTable } from "@/components/settings/DependencyTable";
import { AppFormModal } from "./AppFormModal";
import type { AppEntry } from "@/lib/queries/apps";

export function AppsTable({ rows }: { rows: AppEntry[] }) {
  const router = useRouter();
  const [formState, setFormState] = useState<{ row: AppEntry | null } | null>(null);
  const [deletingRow, setDeletingRow] = useState<AppEntry | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deletingRow) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteApp(getBrowserSupabaseClient(), { appId: deletingRow.id });
      setDeletingRow(null);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete this app. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onPress={() => setFormState({ row: null })}>Add app</Button>
      </div>

      <DependencyTable
        rows={rows}
        ariaLabel="Apps"
        searchPlaceholder="Search apps…"
        searchKeys={["key", "name", "description"]}
        emptyMessage="No apps registered yet."
        columns={[
          { key: "name", header: "Name", render: (app) => <span className="font-medium text-foreground">{app.name}</span> },
          { key: "key", header: "Key", render: (app) => <code className="text-xs">{app.key}</code> },
          { key: "description", header: "Description", render: (app) => app.description ?? "—" },
          {
            key: "isActive",
            header: "Status",
            render: (app) => (
              <Chip color={app.is_active ? "success" : "default"} size="sm">
                <Chip.Label>{app.is_active ? "Active" : "Inactive"}</Chip.Label>
              </Chip>
            ),
          },
        ]}
        renderActions={(app) => (
          <div className="flex justify-end gap-2">
            <Button variant="tertiary" size="sm" onPress={() => setFormState({ row: app })}>
              Edit
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              onPress={() => {
                setDeletingRow(app);
                setDeleteError(null);
              }}
            >
              Delete
            </Button>
          </div>
        )}
      />

      <AppFormModal isOpen={formState !== null} onClose={() => setFormState(null)} editingRow={formState?.row ?? null} />

      <AlertDialog.Root isOpen={deletingRow !== null} onOpenChange={(open) => !open && setDeletingRow(null)}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Header>
                <AlertDialog.Heading>Delete {deletingRow?.name}?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                This can&rsquo;t be undone. An app still referenced by permissions or role access grants can&rsquo;t be
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
