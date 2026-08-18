"use client";

import { useState } from "react";
import { Button } from "@jaipur-rugs/ui-kit";
import { NewDriverModal } from "./NewDriverModal";

export function AddDriverAction() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button onPress={() => setIsOpen(true)}>Add driver</Button>
      <NewDriverModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
