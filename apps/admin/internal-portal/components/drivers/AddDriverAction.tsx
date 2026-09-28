"use client";

import { useState } from "react";
import { Button } from "@jaipur-rugs/ui-kit";
import { DriverFormModal } from "./DriverFormModal";

export function AddDriverAction() {
  const [isOpen, setIsOpen] = useState(false);
  // Bumped per open so the form remounts empty, instead of keeping a cancelled draft.
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <Button
        onPress={() => {
          setFormKey((k) => k + 1);
          setIsOpen(true);
        }}
      >
        Add driver
      </Button>
      <DriverFormModal key={formKey} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
