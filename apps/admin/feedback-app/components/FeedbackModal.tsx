"use client";

import { useEffect, useState } from "react";
import { TextField, TextArea, Label } from "@heroui/react";
import { Modal, Button, DateField, StarRating } from "@jaipur-rugs/ui-kit";
import { submitFeedback } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { getGuestIdCookie, getEmployeeIdCookie } from "@/lib/authCookies";
import type { Driver } from "./DriverGrid";

type Step = "date" | "rating" | "success";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FeedbackModal({ driver, onClose }: { driver: Driver | null; onClose: () => void }) {
  const [step, setStep] = useState<Step>("date");
  const [travelDate, setTravelDate] = useState(todayIsoDate());
  const [rating, setRating] = useState(0);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset the flow every time a new driver is opened, rather than leaving stale state
  // from the previous review behind.
  useEffect(() => {
    if (driver) {
      setStep("date");
      setTravelDate(todayIsoDate());
      setRating(0);
      setDescription("");
      setError(null);
    }
  }, [driver]);

  async function handleSubmit() {
    if (!driver || rating === 0) {
      setError("Please choose a rating.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const guestId = getGuestIdCookie();
      const employeeId = getEmployeeIdCookie();
      await submitFeedback(supabase, {
        driverId: driver.id,
        travelDate,
        rating,
        description: description.trim() || undefined,
        // Exactly one of these is set — neither guests nor employees carry a Supabase
        // session in this app, so whichever cookie the proxy gate let through on is the
        // reviewer's identity.
        guestId: guestId ?? undefined,
        employeeId: employeeId ?? undefined,
      });
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen={driver !== null} onOpenChange={(open) => !open && onClose()}>
        <Modal.Container placement="center">
          <Modal.Dialog className="sm:max-w-[400px]">
            {driver && (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>{driver.fullName}</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  {step === "date" && (
                    <DateField
                      label="Date of travel"
                      value={travelDate}
                      max={todayIsoDate()}
                      onChange={setTravelDate}
                    />
                  )}

                  {step === "rating" && (
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-sm text-muted">How was your trip?</span>
                        <StarRating value={rating} onChange={setRating} />
                      </div>
                      <TextField value={description} onChange={setDescription}>
                        <Label>Tell us more (optional)</Label>
                        <TextArea rows={3} />
                      </TextField>
                      {error ? <p className="text-sm text-danger">{error}</p> : null}
                    </div>
                  )}

                  {step === "success" && <p className="py-4 text-center text-muted">Thanks for your feedback!</p>}
                </Modal.Body>
                <Modal.Footer>
                  {step === "date" && (
                    <Button fullWidth onPress={() => setStep("rating")}>
                      Next
                    </Button>
                  )}
                  {step === "rating" && (
                    <div className="flex w-full gap-2">
                      <Button variant="secondary" onPress={() => setStep("date")}>
                        Back
                      </Button>
                      <Button fullWidth isPending={submitting} onPress={handleSubmit}>
                        Submit
                      </Button>
                    </div>
                  )}
                  {step === "success" && (
                    <Button fullWidth onPress={onClose}>
                      Done
                    </Button>
                  )}
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
