"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs } from "@heroui/react";
import { Button, TextField, PhoneInput, Modal } from "@jaipur-rugs/ui-kit";
import {
  guestCheckIn,
  employeeSignIn,
  EmployeeNotFoundError,
  EmployeePhoneMatchPendingError,
  EmployeeEmailNotFoundError,
  EmployeeEmailMatchPendingError,
} from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { setGuestIdCookie, setEmployeeIdCookie } from "@/lib/authCookies";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">Driver Feedback</h1>
        <p className="text-sm text-muted">Sign in to rate your trip.</p>
      </div>
      <Tabs className="login-tabs w-full" defaultSelectedKey="employee">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Login method" className="w-full">
            <Tabs.Tab className="flex-1" id="employee">
              Employee
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab className="flex-1" id="guest">
              Guest
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        {/* Fixed, equal min-height on both panels — the tab indicator's slide is a FLIP
            transition measured with getBoundingClientRect() in viewport coordinates, so if
            switching tabs changed the panel height (this card is vertically centered), the
            page reflow adds an unwanted vertical component and the indicator visibly curves
            instead of sliding in a straight line. */}
        <Tabs.Panel id="employee" className="min-h-[200px]">
          <EmployeeLoginForm />
        </Tabs.Panel>
        <Tabs.Panel id="guest" className="min-h-[200px]">
          <GuestLoginForm />
        </Tabs.Panel>
      </Tabs>
    </main>
  );
}

// Recovery cascade after employee_code matches nothing — never speculative, each step is
// only reachable by first hitting the specific typed error the previous step throws (see
// EmployeeSignInInput's `action` docs in db-management-client). "phoneMatch"/"emailMatch"
// are confirm-only (no fields collected — the match was already found by data the person
// already typed); "emailPrompt"/"createNew" each collect exactly one new, still-needed
// field (an email to search by, then a full name to create with).
type RecoveryStep = "phoneMatch" | "emailPrompt" | "emailMatch" | "createNew" | null;

function EmployeeLoginForm() {
  const router = useRouter();
  const [employeeCode, setEmployeeCode] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>(null);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryFullName, setRecoveryFullName] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);

  function resetRecovery() {
    setRecoveryStep(null);
    setRecoveryEmail("");
    setRecoveryFullName("");
    setRecoveryError(null);
  }

  function finishLogin(employeeId: string) {
    setEmployeeIdCookie(employeeId);
    router.push("/drivers");
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!phone) {
      setError("Please enter a phone number.");
      setSubmitting(false);
      return;
    }

    try {
      // Matched against the employees table (employee_code + phone) — not Supabase Auth.
      // No password, no auth.users row, no session (see supabase/functions/employee-signin).
      // Remembering "this browser is employee X" is just a plain cookie, set below.
      const supabase = getBrowserSupabaseClient();
      const { employeeId } = await employeeSignIn(supabase, { employeeCode, phone });
      finishLogin(employeeId);
    } catch (err) {
      if (err instanceof EmployeePhoneMatchPendingError) {
        setRecoveryError(null);
        setRecoveryStep("phoneMatch");
      } else if (err instanceof EmployeeNotFoundError) {
        setRecoveryError(null);
        setRecoveryStep("emailPrompt");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmPhoneMatch() {
    setRecoverySubmitting(true);
    setRecoveryError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const { employeeId } = await employeeSignIn(supabase, { employeeCode, phone, action: "confirmPhoneMatch" });
      finishLogin(employeeId);
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setRecoverySubmitting(false);
    }
  }

  async function handleLookupEmail() {
    if (!recoveryEmail.trim()) {
      setRecoveryError("Please enter your email.");
      return;
    }
    setRecoverySubmitting(true);
    setRecoveryError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      await employeeSignIn(supabase, { employeeCode, phone, action: "lookupEmail", email: recoveryEmail });
      // lookupEmail always throws (either match-pending or not-found) — it never resolves.
    } catch (err) {
      if (err instanceof EmployeeEmailMatchPendingError) {
        setRecoveryError(null);
        setRecoveryStep("emailMatch");
      } else if (err instanceof EmployeeEmailNotFoundError) {
        setRecoveryError(null);
        setRecoveryStep("createNew");
      } else {
        setRecoveryError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setRecoverySubmitting(false);
    }
  }

  async function handleConfirmEmailMatch() {
    setRecoverySubmitting(true);
    setRecoveryError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const { employeeId } = await employeeSignIn(supabase, {
        employeeCode,
        phone,
        action: "confirmEmailMatch",
        email: recoveryEmail,
      });
      finishLogin(employeeId);
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setRecoverySubmitting(false);
    }
  }

  async function handleCreateNew() {
    if (!recoveryFullName.trim()) {
      setRecoveryError("Please enter your full name.");
      return;
    }
    setRecoverySubmitting(true);
    setRecoveryError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      const { employeeId } = await employeeSignIn(supabase, {
        employeeCode,
        phone,
        action: "createNew",
        email: recoveryEmail,
        fullName: recoveryFullName,
      });
      finishLogin(employeeId);
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setRecoverySubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-4">
        <TextField label="Employee code" value={employeeCode} onChange={setEmployeeCode} isRequired autoFocus fullWidth />
        {/* Plain phone field, no country-code picker — employees are one domestic HR
            roster (unlike guests' mandatory multi-country E.164), and the seeded data has
            no country code at all. employee-signin matches on the last 10 digits, so
            formatting here doesn't need to be exact. */}
        <TextField label="Phone number" type="tel" value={phone} onChange={setPhone} isRequired fullWidth />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" isPending={submitting} fullWidth>
          Sign in
        </Button>
      </form>

      <Modal>
        <Modal.Backdrop isOpen={recoveryStep !== null} onOpenChange={(open) => !open && resetRecovery()}>
          <Modal.Container placement="center">
            <Modal.Dialog className="sm:max-w-[400px]">
              <Modal.CloseTrigger />

              {recoveryStep === "phoneMatch" && (
                <>
                  <Modal.Header>
                    <Modal.Heading>Sign in with this phone number?</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-sm text-muted">
                      Code <strong>{employeeCode.toUpperCase()}</strong> doesn&apos;t exist, but an existing
                      record matches this phone number. Sign in as that employee?
                    </p>
                    {recoveryError ? <p className="mt-3 text-sm text-danger">{recoveryError}</p> : null}
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={resetRecovery}>
                      Cancel
                    </Button>
                    <Button fullWidth isPending={recoverySubmitting} onPress={handleConfirmPhoneMatch}>
                      Sign in
                    </Button>
                  </Modal.Footer>
                </>
              )}

              {recoveryStep === "emailPrompt" && (
                <>
                  <Modal.Header>
                    <Modal.Heading>No record found</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="mb-4 text-sm text-muted">
                      No employee matches that code or phone number. Enter your email so we can check for
                      an existing record.
                    </p>
                    <TextField
                      label="Email"
                      type="email"
                      value={recoveryEmail}
                      onChange={setRecoveryEmail}
                      isRequired
                      autoFocus
                      fullWidth
                    />
                    {recoveryError ? <p className="mt-3 text-sm text-danger">{recoveryError}</p> : null}
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={resetRecovery}>
                      Cancel
                    </Button>
                    <Button fullWidth isPending={recoverySubmitting} onPress={handleLookupEmail}>
                      Continue
                    </Button>
                  </Modal.Footer>
                </>
              )}

              {recoveryStep === "emailMatch" && (
                <>
                  <Modal.Header>
                    <Modal.Heading>Sign in with this email?</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-sm text-muted">
                      An existing record matches <strong>{recoveryEmail}</strong>. Sign in as that employee?
                    </p>
                    {recoveryError ? <p className="mt-3 text-sm text-danger">{recoveryError}</p> : null}
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={resetRecovery}>
                      Cancel
                    </Button>
                    <Button fullWidth isPending={recoverySubmitting} onPress={handleConfirmEmailMatch}>
                      Sign in
                    </Button>
                  </Modal.Footer>
                </>
              )}

              {recoveryStep === "createNew" && (
                <>
                  <Modal.Header>
                    <Modal.Heading>Create new employee record?</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="mb-4 text-sm text-muted">
                      No record matches <strong>{recoveryEmail}</strong> either. Enter your full name to
                      create one and sign in — you&apos;ll be given a proper employee code for next time.
                    </p>
                    <TextField
                      label="Full name"
                      value={recoveryFullName}
                      onChange={setRecoveryFullName}
                      isRequired
                      autoFocus
                      fullWidth
                    />
                    {recoveryError ? <p className="mt-3 text-sm text-danger">{recoveryError}</p> : null}
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={resetRecovery}>
                      Cancel
                    </Button>
                    <Button fullWidth isPending={recoverySubmitting} onPress={handleCreateNew}>
                      Create &amp; sign in
                    </Button>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}

function GuestLoginForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!phone) {
      setError("Please enter a phone number.");
      setSubmitting(false);
      return;
    }

    try {
      // Pure data entry, not Supabase Auth — guests never get an auth.users row or a
      // session (see supabase/functions/guest-signup). A matched or newly-created
      // guestId is all we get back; remembering "this browser is guest X" is just a
      // plain cookie, set below.
      const supabase = getBrowserSupabaseClient();
      const { guestId } = await guestCheckIn(supabase, { fullName, phone });
      setGuestIdCookie(guestId);
      router.push("/drivers");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-4">
      <TextField label="Full name" value={fullName} onChange={setFullName} isRequired autoFocus fullWidth />
      <PhoneInput label="Phone number" value={phone} onChange={setPhone} isRequired />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" isPending={submitting} fullWidth>
        Continue
      </Button>
    </form>
  );
}
