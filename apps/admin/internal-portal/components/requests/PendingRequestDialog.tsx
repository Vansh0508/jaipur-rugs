"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@jaipur-rugs/ui-kit";
import { isRequestExpired, type ConferenceRequest } from "@/lib/queries/bookingRequests";
import { formatDate, formatTime } from "@/lib/format";
import { ApproveConferenceDialog, RejectRequestDialog } from "./DecisionDialogs";

// What clicking a pending request's dashed block on the conference calendar opens: the
// request in full, with Approve / Reject — the same decision dialogs (and the same server
// rules) as the Requests tab and the Dashboard.

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function PendingRequestDialog({ request, onClose }: { request: ConferenceRequest | null; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "approve" | "reject">("details");
  const expired = request ? isRequestExpired(request) : false;

  function close() {
    setStep("details");
    onClose();
  }

  function decided() {
    close();
    router.refresh();
  }

  return (
    <>
      <Modal>
        <Modal.Backdrop isOpen={request !== null && step === "details"} onOpenChange={(open) => !open && close()}>
          <Modal.Container scroll="inside">
            <Modal.Dialog className="sm:max-w-[480px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{request?.eventName ?? ""}</Modal.Heading>
                <p className="text-sm text-muted">Pending request — not booked yet</p>
              </Modal.Header>
              {request ? (
                <Modal.Body>
                  <dl className="grid grid-cols-2 gap-4">
                    <Detail label="Room">{request.roomName}</Detail>
                    <Detail label="When">
                      {formatDate(request.startsAt)}, {formatTime(request.startsAt)} – {formatTime(request.endsAt)}
                    </Detail>
                    <Detail label="Requested by">
                      {request.requester.fullName}
                      {request.requester.employeeCode ? <span className="text-muted tabular-nums"> · {request.requester.employeeCode}</span> : null}
                    </Detail>
                    <Detail label="Department">{request.requester.departmentName ?? "—"}</Detail>
                    <Detail label="Sitting arrangement">
                      {request.seatingCount}
                      {request.roomCapacity ? <span className="text-muted"> (room seats {request.roomCapacity})</span> : null}
                    </Detail>
                    <Detail label="Sent">
                      {formatDate(request.createdAt)} {formatTime(request.createdAt)}
                    </Detail>
                    {request.eventDetails ? (
                      <div className="col-span-2">
                        <Detail label="Event details">{request.eventDetails}</Detail>
                      </div>
                    ) : null}
                  </dl>
                  {expired ? <p className="mt-4 text-sm text-danger">Its start time has passed, so it can only be rejected.</p> : null}
                </Modal.Body>
              ) : null}
              <Modal.Footer>
                <Button variant="secondary" onPress={() => setStep("reject")}>
                  Reject
                </Button>
                <Button onPress={() => setStep("approve")} isDisabled={expired}>
                  Approve
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ApproveConferenceDialog request={step === "approve" ? request : null} onClose={() => setStep("details")} onDecided={decided} />
      <RejectRequestDialog request={step === "reject" ? request : null} onClose={() => setStep("details")} onDecided={decided} />
    </>
  );
}
