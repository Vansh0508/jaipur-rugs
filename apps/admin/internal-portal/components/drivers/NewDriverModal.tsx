"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ImageUploadField, Modal, PhoneInput, TextField } from "@jaipur-rugs/ui-kit";
import { createDriver, uploadDriverPhoto } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

export function NewDriverModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setFullName("");
    setPhone("");
    setPhotoFile(null);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      let photoPath: string | undefined;
      if (photoFile) {
        const uploaded = await uploadDriverPhoto(supabase, photoFile);
        photoPath = uploaded.photoPath;
      }
      await createDriver(supabase, { fullName, phone, photoPath });
      reset();
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create driver. Please try again.");
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
              <Modal.Heading>Add driver</Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSubmit}>
              <Modal.Body className="flex flex-col gap-4">
                <TextField label="Name" value={fullName} onChange={setFullName} isRequired fullWidth />
                <PhoneInput label="Phone number" value={phone} onChange={setPhone} isRequired />
                <ImageUploadField label="Photo (optional)" onFileSelect={setPhotoFile} />
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button type="submit" fullWidth isPending={submitting}>
                  Add driver
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
