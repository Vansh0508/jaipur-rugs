"use client";

import { useState } from "react";
import { Button } from "@jaipur-rugs/ui-kit";
import { NewCarModal } from "./NewCarModal";

export function AddCarAction() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button onPress={() => setIsOpen(true)}>Add car</Button>
      <NewCarModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
