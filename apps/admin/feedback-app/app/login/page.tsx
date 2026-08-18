"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs } from "@heroui/react";
import { Button, TextField, PhoneInput } from "@jaipur-rugs/ui-kit";
import { guestCheckIn, employeeSignIn } from "@jaipur-rugs/db-management-client";
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

function EmployeeLoginForm() {
  const router = useRouter();
  const [employeeCode, setEmployeeCode] = useState("");
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
      // Matched against the employees table (employee_code + phone) — not Supabase Auth.
      // No password, no auth.users row, no session (see supabase/functions/employee-signin).
      // Remembering "this browser is employee X" is just a plain cookie, set below.
      const supabase = getBrowserSupabaseClient();
      const { employeeId } = await employeeSignIn(supabase, { employeeCode, phone });
      setEmployeeIdCookie(employeeId);
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
