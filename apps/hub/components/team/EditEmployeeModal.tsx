"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Select } from "@jaipur-rugs/ui-kit";
import { updateEmployee } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { TeamDirectoryRow } from "@/lib/queries/employees";
import type { Department } from "@/lib/queries/departments";
import type { Role } from "@/lib/queries/roles";

const EMPLOYMENT_TYPES = [
  { id: "full_time", label: "Full-time" },
  { id: "part_time", label: "Part-time" },
  { id: "contract", label: "Contract" },
  { id: "intern", label: "Intern" },
  { id: "consultant", label: "Consultant" },
] as const;

const STATUSES = [
  { id: "invited", label: "Invited" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
  { id: "on_leave", label: "On leave" },
  { id: "offboarded", label: "Offboarded" },
] as const;

export function EditEmployeeModal({
  row,
  onClose,
  departments,
  roles,
  managerCandidates,
}: {
  row: TeamDirectoryRow | null;
  onClose: () => void;
  departments: Pick<Department, "id" | "name">[];
  roles: Pick<Role, "id" | "name">[];
  managerCandidates: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [primaryRoleId, setPrimaryRoleId] = useState<string | null>(null);
  const [employmentType, setEmploymentType] = useState<string>("full_time");
  const [status, setStatus] = useState<string>("active");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The Modal stays mounted across edits (only `row` swaps), so fields are reset here
  // rather than via useState initializers, which only run on first mount.
  useEffect(() => {
    if (!row) return;
    setDepartmentId(row.departmentId);
    setManagerId(row.managerId);
    setPrimaryRoleId(row.primaryRoleId);
    setEmploymentType(row.employmentType);
    setStatus(row.status);
    setError(null);
  }, [row]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!row) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateEmployee(getBrowserSupabaseClient(), {
        employeeId: row.id,
        departmentId,
        managerId,
        primaryRoleId,
        employmentType: employmentType as (typeof EMPLOYMENT_TYPES)[number]["id"],
        status: status as (typeof STATUSES)[number]["id"],
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this employee. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen={row !== null} onOpenChange={(open) => !open && onClose()}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[420px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{row ? `Edit ${row.fullName}` : "Edit team member"}</Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSubmit}>
              <Modal.Body className="flex flex-col gap-4">
                <Select
                  label="Department"
                  items={departments.map((d) => ({ id: d.id, label: d.name }))}
                  value={departmentId}
                  onChange={setDepartmentId}
                  placeholder="Select a department"
                  fullWidth
                />
                <Select
                  label="Manager"
                  items={managerCandidates.filter((m) => m.id !== row?.id).map((m) => ({ id: m.id, label: m.full_name }))}
                  value={managerId}
                  onChange={setManagerId}
                  placeholder="Select a manager"
                  fullWidth
                />
                <Select
                  label="Role"
                  items={roles.map((r) => ({ id: r.id, label: r.name }))}
                  value={primaryRoleId}
                  onChange={setPrimaryRoleId}
                  placeholder="Select a role"
                  fullWidth
                />
                <Select
                  label="Employment type"
                  items={EMPLOYMENT_TYPES.map((t) => ({ id: t.id, label: t.label }))}
                  value={employmentType}
                  onChange={(value) => value && setEmploymentType(value)}
                  isRequired
                  fullWidth
                />
                <Select
                  label="Status"
                  items={STATUSES.map((s) => ({ id: s.id, label: s.label }))}
                  value={status}
                  onChange={(value) => value && setStatus(value)}
                  isRequired
                  fullWidth
                />
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button type="submit" fullWidth isPending={submitting}>
                  Save changes
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
