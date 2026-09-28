"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Select, TextField } from "@jaipur-rugs/ui-kit";
import { createCar, updateCar, type FuelType } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { Car } from "@/lib/queries/cars";
import { FUEL_LABEL } from "./fuelLabels";

const FUEL_OPTIONS = (Object.entries(FUEL_LABEL) as [FuelType, string][]).map(([id, label]) => ({ id, label }));

/**
 * Add car (no `car`) or Edit car (`car` given) — one form, since update-car takes exactly
 * create-car's fields. State is seeded from `car` once, on mount: callers remount it per
 * open via a changing `key` (see AddCarAction / CarActionsMenu), so reopening always shows
 * the car's current values, never a previous edit's leftovers.
 */
export function CarFormModal({ isOpen, onClose, car }: { isOpen: boolean; onClose: () => void; car?: Car }) {
  const router = useRouter();
  const [name, setName] = useState(car?.name ?? "");
  const [make, setMake] = useState(car?.make ?? "");
  const [model, setModel] = useState(car?.model ?? "");
  const [fuelType, setFuelType] = useState<FuelType>(car?.fuel_type ?? "petrol");
  const [registrationNumber, setRegistrationNumber] = useState(car?.registration_number ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(car);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const fields = { name, make, model, fuelType, registrationNumber };
      if (car) await updateCar(supabase, { vehicleId: car.id, ...fields });
      else await createCar(supabase, fields);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${isEdit ? "save" : "create"} car. Please try again.`);
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
              <Modal.Heading>{isEdit ? "Edit car" : "Add car"}</Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSubmit}>
              <Modal.Body className="flex flex-col gap-4">
                <TextField label="Name" value={name} onChange={setName} isRequired fullWidth />
                <TextField label="Make" value={make} onChange={setMake} isRequired fullWidth />
                <TextField label="Model" value={model} onChange={setModel} isRequired fullWidth />
                {/* ui-kit's Select wrapper, not the raw Hero UI compound — it renders the visible
                    <Label>, matching the TextFields above (the raw one had only an aria-label). */}
                <Select
                  label="Fuel type"
                  items={FUEL_OPTIONS}
                  value={fuelType}
                  onChange={(value) => value && setFuelType(value as FuelType)}
                  isRequired
                  fullWidth
                />
                <TextField label="Number plate" value={registrationNumber} onChange={setRegistrationNumber} isRequired fullWidth />
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button type="submit" fullWidth isPending={submitting}>
                  {isEdit ? "Save changes" : "Add car"}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
