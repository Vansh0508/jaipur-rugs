"use client";

import { useState } from "react";
import { Button } from "@jaipur-rugs/ui-kit";
import { AddTeamMemberModal } from "./AddTeamMemberModal";
import type { Department } from "@/lib/queries/departments";
import type { Role } from "@/lib/queries/roles";

export function AddTeamMemberAction({
  departments,
  roles,
  managerCandidates,
}: {
  departments: Pick<Department, "id" | "name">[];
  roles: Pick<Role, "id" | "name">[];
  managerCandidates: { id: string; full_name: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button onPress={() => setIsOpen(true)}>Add team member</Button>
      <AddTeamMemberModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        departments={departments}
        roles={roles}
        managerCandidates={managerCandidates}
      />
    </>
  );
}
