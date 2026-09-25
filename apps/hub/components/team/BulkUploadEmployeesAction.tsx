"use client";

import { useState } from "react";
import { Button } from "@jaipur-rugs/ui-kit";
import { BulkUploadEmployeesModal } from "./BulkUploadEmployeesModal";
import type { Department } from "@/lib/queries/departments";
import type { Role } from "@/lib/queries/roles";
import type { TeamDirectoryRow } from "@/lib/queries/employees";

export function BulkUploadEmployeesAction({
  departments,
  roles,
  directory,
}: {
  departments: Pick<Department, "id" | "name">[];
  roles: Pick<Role, "id" | "name">[];
  directory: TeamDirectoryRow[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button variant="tertiary" onPress={() => setIsOpen(true)}>
        Bulk upload
      </Button>
      <BulkUploadEmployeesModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        departments={departments}
        roles={roles}
        directory={directory}
      />
    </>
  );
}
