"use client";

import { useState } from "react";
import { Button } from "@jaipur-rugs/ui-kit";
import { CarFormModal } from "./CarFormModal";

export function AddCarAction() {
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
        Add car
      </Button>
      <CarFormModal key={formKey} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
