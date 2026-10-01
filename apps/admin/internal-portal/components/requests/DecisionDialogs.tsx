"use client";

import { useEffect, useState } from "react";
import { Label, TextArea, TextField as HeroTextField } from "@heroui/react";
import { Button, Modal } from "@jaipur-rugs/ui-kit";
import { decideConferenceRequest, decideJourneyRequest } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { getAvailableCarsForWindow, type CarAvailability } from "@/lib/queries/cars";
import { getAvailableDriversForWindow, type DriverAvailability } from "@/lib/queries/drivers";
import type { BookingRequest, ConferenceRequest, JourneyRequest } from "@/lib/queries/bookingRequests";
import { formatDate, formatTime } from "@/lib/format";
import { CarPicker, DriverPicker } from "@/components/journeys/builder/pickers";
import { FieldError } from "@/components/journeys/builder/fields";

// The admin's decision on an employee's request (db/booking-requests/). Approving a
// conference request books the room as asked; approving a journey request needs a car and a
// driver, picked here against availability for the trip's window (same pickers and
// availability check as the New journey builder). Rejecting takes an optional reason. Every
// rule is re-checked by the server — a clash found only at that moment comes back as the
// dialog's error, and the request stays pending.

function NoteField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <HeroTextField fullWidth value={value} onChange={onChange}>
      <Label>{label}</Label>
      <TextArea rows={3} placeholder={placeholder} />
    </HeroTextField>
  );
}

function when(request: BookingRequest) {
  if (request.kind === "conference") {
    return `${formatDate(request.startsAt)}, ${formatTime(request.startsAt)} – ${formatTime(request.endsAt)}`;
  }
  const from = formatDate(request.firstPickupAt);
  const to = formatDate(request.lastDropAt);
  return from === to
    ? `${from}, ${formatTime(request.firstPickupAt)} – ${formatTime(request.lastDropAt)}`
    : `${from} ${formatTime(request.firstPickupAt)} – ${to} ${formatTime(request.lastDropAt)}`;
}

function DialogShell({
  isOpen,
  onClose,
  heading,
  children,
  footer,
}: {
  isOpen: boolean;
  onClose: () => void;
  heading: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Modal.Container scroll="inside">
          <Modal.Dialog className="sm:max-w-[520px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{heading}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">{children}</Modal.Body>
            <Modal.Footer>{footer}</Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function Summary({ request }: { request: BookingRequest }) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary/40 p-3 text-sm">
      <p className="font-semibold text-foreground">
        {request.kind === "conference" ? `${request.eventName} · ${request.roomName}` : request.routeSummary}
      </p>
      <p className="mt-0.5 text-muted">{when(request)}</p>
      <p className="mt-0.5 text-muted">
        Requested by {request.requester.fullName}
        {request.requester.employeeCode ? ` (${request.requester.employeeCode})` : ""}
      </p>
    </div>
  );
}

export function ApproveConferenceDialog({
  request,
  onClose,
  onDecided,
}: {
  request: ConferenceRequest | null;
  onClose: () => void;
  onDecided: (request: ConferenceRequest) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => setError(null), [request?.id]);

  async function approve() {
    if (!request) return;
    setPending(true);
    setError(null);
    try {
      await decideConferenceRequest(getBrowserSupabaseClient(), { requestId: request.id, decision: "approved" });
      onDecided(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve the request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogShell
      isOpen={request !== null}
      onClose={onClose}
      heading="Approve conference request?"
      footer={
        <>
          <Button variant="secondary" onPress={onClose} isDisabled={pending}>
            Cancel
          </Button>
          <Button onPress={approve} isPending={pending}>
            Approve and book
          </Button>
        </>
      }
    >
      {request ? (
        <>
          <Summary request={request} />
          <p className="text-sm text-muted">
            {request.roomName} will be booked for {request.requester.fullName}, {request.seatingCount} seat{request.seatingCount === 1 ? "" : "s"}.
          </p>
        </>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </DialogShell>
  );
}

export function ApproveJourneyDialog({
  request,
  onClose,
  onDecided,
}: {
  request: JourneyRequest | null;
  onClose: () => void;
  onDecided: (request: JourneyRequest) => void;
}) {
  const [carId, setCarId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [cars, setCars] = useState<CarAvailability[]>([]);
  const [drivers, setDrivers] = useState<DriverAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ car?: string; driver?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Fresh pickers and availability for each request opened.
  useEffect(() => {
    setCarId("");
    setDriverId("");
    setErrors({});
    setError(null);
    if (!request) return;
    let cancelled = false;
    setLoading(true);
    const supabase = getBrowserSupabaseClient();
    Promise.all([
      getAvailableCarsForWindow(supabase, request.firstPickupAt, request.lastDropAt),
      getAvailableDriversForWindow(supabase, request.firstPickupAt, request.lastDropAt),
    ])
      .then(([c, d]) => {
        if (cancelled) return;
        setCars(c);
        setDrivers(d);
      })
      .catch(() => !cancelled && setError("Couldn't check car and driver availability. Try again."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [request]);

  async function approve() {
    if (!request) return;
    const next: { car?: string; driver?: string } = {};
    const car = cars.find((c) => c.id === carId);
    const driver = drivers.find((d) => d.id === driverId);
    if (!carId) next.car = "Select a car";
    else if (car && !car.isAvailable) next.car = `This car isn't available then (${car.unavailableReason})`;
    if (!driverId) next.driver = "Select a driver";
    else if (driver && !driver.isAvailable) next.driver = `This driver isn't available then (${driver.unavailableReason})`;
    setErrors(next);
    if (next.car || next.driver) return;

    setPending(true);
    setError(null);
    try {
      await decideJourneyRequest(getBrowserSupabaseClient(), { requestId: request.id, decision: "approved", vehicleId: carId, driverId });
      onDecided(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve the request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogShell
      isOpen={request !== null}
      onClose={onClose}
      heading="Approve journey request"
      footer={
        <>
          <Button variant="secondary" onPress={onClose} isDisabled={pending}>
            Cancel
          </Button>
          <Button onPress={approve} isPending={pending}>
            Approve and plan journey
          </Button>
        </>
      }
    >
      {request ? <Summary request={request} /> : null}
      <p className="text-sm text-muted">Assign the car and driver. Only ones free for the whole trip can be picked.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <CarPicker cars={cars} value={carId} onChange={setCarId} isLoading={loading} />
          <FieldError msg={errors.car} />
        </div>
        <div>
          <DriverPicker drivers={drivers} value={driverId} onChange={setDriverId} isLoading={loading} />
          <FieldError msg={errors.driver} />
        </div>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </DialogShell>
  );
}

export function RejectRequestDialog({
  request,
  onClose,
  onDecided,
}: {
  request: BookingRequest | null;
  onClose: () => void;
  onDecided: (request: BookingRequest) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setNote("");
    setError(null);
  }, [request?.id]);

  async function reject() {
    if (!request) return;
    setPending(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const input = { requestId: request.id, decision: "rejected" as const, note: note.trim() || undefined };
      if (request.kind === "conference") await decideConferenceRequest(supabase, input);
      else await decideJourneyRequest(supabase, input);
      onDecided(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject the request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogShell
      isOpen={request !== null}
      onClose={onClose}
      heading={request?.kind === "journey" ? "Reject journey request?" : "Reject conference request?"}
      footer={
        <>
          <Button variant="secondary" onPress={onClose} isDisabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onPress={reject} isPending={pending}>
            Reject request
          </Button>
        </>
      }
    >
      {request ? <Summary request={request} /> : null}
      <NoteField label="Reason (optional)" value={note} onChange={setNote} placeholder="e.g. The room is needed for an internal event" />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </DialogShell>
  );
}
