"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListBox, Select } from "@heroui/react";
import { Button, Modal, TextField } from "@jaipur-rugs/ui-kit";
import { createCar } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

const FUEL_TYPES = [
  { id: "petrol", label: "Petrol" },
  { id: "diesel", label: "Diesel" },
  { id: "ev", label: "EV" },
] as const;

export function NewCarModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [fuelType, setFuelType] = useState<string>("petrol");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setMake("");
    setModel("");
    setFuelType("petrol");
    setRegistrationNumber("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createCar(getBrowserSupabaseClient(), {
        name,
        make,
        model,
        fuelType: fuelType as "petrol" | "diesel" | "ev",
        registrationNumber,
      });
      reset();
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create car. Please try again.");
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
              <Modal.Heading>Add car</Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSubmit}>
              <Modal.Body className="flex flex-col gap-4">
                <TextField label="Name" value={name} onChange={setName} isRequired fullWidth />
                <TextField label="Make" value={make} onChange={setMake} isRequired fullWidth />
                <TextField label="Model" value={model} onChange={setModel} isRequired fullWidth />
                <Select value={fuelType} onChange={(key) => setFuelType(String(key))} fullWidth>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {FUEL_TYPES.map((f) => (
                        <ListBox.Item key={f.id} id={f.id} textValue={f.label}>
                          {f.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <TextField label="Number plate" value={registrationNumber} onChange={setRegistrationNumber} isRequired fullWidth />
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button type="submit" fullWidth isPending={submitting}>
                  Add car
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
