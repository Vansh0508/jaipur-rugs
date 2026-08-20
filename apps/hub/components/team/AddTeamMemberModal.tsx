"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Select, TextField } from "@jaipur-rugs/ui-kit";
import { inviteEmployee } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { Department } from "@/lib/queries/departments";
import type { Role } from "@/lib/queries/roles";

const EMPLOYMENT_TYPES = [
  { id: "full_time", label: "Full-time" },
  { id: "part_time", label: "Part-time" },
  { id: "contract", label: "Contract" },
  { id: "intern", label: "Intern" },
  { id: "consultant", label: "Consultant" },
] as const;

export function AddTeamMemberModal({
  isOpen,
  onClose,
  departments,
  roles,
  managerCandidates,
}: {
  isOpen: boolean;
  onClose: () => void;
  departments: Pick<Department, "id" | "name">[];
  roles: Pick<Role, "id" | "name">[];
  managerCandidates: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [primaryRoleId, setPrimaryRoleId] = useState<string | null>(null);
  const [employmentType, setEmploymentType] = useState<string>("full_time");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setFullName("");
    setEmail("");
    setDepartmentId(null);
    setManagerId(null);
    setPrimaryRoleId(null);
    setEmploymentType("full_time");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await inviteEmployee(getBrowserSupabaseClient(), {
        fullName,
        email,
        departmentId: departmentId ?? undefined,
        managerId: managerId ?? undefined,
        primaryRoleId: primaryRoleId ?? undefined,
        employmentType: employmentType as (typeof EMPLOYMENT_TYPES)[number]["id"],
      });
      reset();
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite this person. Please try again.");
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
              <Modal.Heading>Add team member</Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSubmit}>
              <Modal.Body className="flex flex-col gap-4">
                <TextField label="Full name" value={fullName} onChange={setFullName} isRequired fullWidth />
                <TextField label="Email" type="email" value={email} onChange={setEmail} isRequired fullWidth />
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
                  items={managerCandidates.map((m) => ({ id: m.id, label: m.full_name }))}
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
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button type="submit" fullWidth isPending={submitting}>
                  Add team member
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
