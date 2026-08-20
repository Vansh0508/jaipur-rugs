"use client";

import { useState } from "react";
import { Chip } from "@heroui/react";
import { Button } from "@jaipur-rugs/ui-kit";
import { EditEmployeeModal } from "./EditEmployeeModal";
import type { TeamDirectoryRow } from "@/lib/queries/employees";
import type { Department } from "@/lib/queries/departments";
import type { Role } from "@/lib/queries/roles";
import type { Employee } from "@/lib/queries/employees";

const STATUS_COLOR: Record<Employee["status"], "success" | "warning" | "danger" | "default"> = {
  invited: "warning",
  active: "success",
  inactive: "default",
  on_leave: "warning",
  offboarded: "danger",
};

// Plain semantic <table>, not Hero UI's Table component — a directory listing with a
// per-row admin action is simple enough not to need react-aria's collection/selection
// machinery, and this keeps the row rendering trivial to reason about.
export function TeamTable({
  rows,
  canManageTeam,
  departments,
  roles,
  managerCandidates,
}: {
  rows: TeamDirectoryRow[];
  canManageTeam: boolean;
  departments: Pick<Department, "id" | "name">[];
  roles: Pick<Role, "id" | "name">[];
  managerCandidates: { id: string; full_name: string }[];
}) {
  const [editingRow, setEditingRow] = useState<TeamDirectoryRow | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border-2 border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-border text-xs uppercase text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Manager</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canManageTeam ? <th className="px-4 py-3 font-medium" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{row.fullName}</div>
                  <div className="text-xs text-muted">
                    {row.employeeCode} · {row.email}
                  </div>
                </td>
                <td className="px-4 py-3">{row.departmentName ?? "—"}</td>
                <td className="px-4 py-3">{row.managerName ?? "—"}</td>
                <td className="px-4 py-3">{row.roleName ?? "—"}</td>
                <td className="px-4 py-3">
                  <Chip color={STATUS_COLOR[row.status]} size="sm">
                    <Chip.Label>{row.status.replace("_", " ")}</Chip.Label>
                  </Chip>
                </td>
                {canManageTeam ? (
                  <td className="px-4 py-3 text-right">
                    <Button variant="tertiary" size="sm" onPress={() => setEditingRow(row)}>
                      Edit
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManageTeam ? (
        <EditEmployeeModal
          row={editingRow}
          onClose={() => setEditingRow(null)}
          departments={departments}
          roles={roles}
          managerCandidates={managerCandidates}
        />
      ) : null}
    </>
  );
}
