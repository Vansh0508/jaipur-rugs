"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, PhoneInput, TextField } from "@jaipur-rugs/ui-kit";
import { createDriver, updateDriver, uploadDriverPhoto } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { Driver } from "@/lib/queries/drivers";
import { resolvePhotoUrl } from "@/lib/env";
import { PhotoDropzone } from "./PhotoDropzone";

/**
 * Add driver (no `driver`) or Edit driver (`driver` given). Same remount-per-open contract
 * as CarFormModal — PhoneInput in particular only reads its value on mount. On edit, the
 * current photo is kept unless a new one is dropped/picked or it's removed.
 */
export function DriverFormModal({ isOpen, onClose, driver }: { isOpen: boolean; onClose: () => void; driver?: Driver }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(driver?.full_name ?? "");
  const [phone, setPhone] = useState(driver?.phone ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(driver);
  const currentPhotoUrl = removePhoto ? null : resolvePhotoUrl(driver?.photo_path ?? null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      let photoPath: string | null | undefined;
      if (photoFile) photoPath = (await uploadDriverPhoto(supabase, photoFile)).photoPath;
      else if (removePhoto) photoPath = null;

      if (driver) await updateDriver(supabase, { driverId: driver.id, fullName, phone, photoPath });
      else await createDriver(supabase, { fullName, phone, photoPath: photoPath ?? undefined });
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${isEdit ? "save" : "create"} driver. Please try again.`);
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
              <Modal.Heading>{isEdit ? "Edit driver" : "Add driver"}</Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSubmit}>
              <Modal.Body className="flex flex-col gap-4">
                <TextField label="Name" value={fullName} onChange={setFullName} isRequired fullWidth />
                <PhoneInput label="Phone number" value={phone} onChange={setPhone} isRequired />
                <PhotoDropzone
                  label="Photo (optional)"
                  file={photoFile}
                  onFileChange={setPhotoFile}
                  currentPhotoUrl={currentPhotoUrl}
                  onRemove={() => {
                    // A newly picked file is discarded first; the saved photo only on a second Remove.
                    if (photoFile) setPhotoFile(null);
                    else setRemovePhoto(true);
                  }}
                />
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button type="submit" fullWidth isPending={submitting}>
                  {isEdit ? "Save changes" : "Add driver"}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
