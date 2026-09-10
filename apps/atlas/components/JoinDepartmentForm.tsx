"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Select } from "@jaipur-rugs/ui-kit";
import { joinOwnDepartment, type SelfServiceDepartmentCode } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

const DEPARTMENT_OPTIONS = [
  { id: "management", label: "Management" },
  { id: "production", label: "Production" },
  { id: "backops", label: "Back Ops" },
] as const;

// The /my-access counterpart to the signup form's department picker (see
// apps/atlas/app/signup/SignupForm.tsx's comment) — added 2026-09-10 because someone who
// picked nothing (or Sales, without a code) at sign-up previously had no way to add
// Management/Production access afterward short of an admin doing it for them; this page
// only offered the sales-code form. Same self-service posture as that form: no approval
// step, always the caller's own account, always 'view' level (join-department's own
// guardrail, not this component's).
//
// "Back Ops" (added 2026-09-10, same session as the customer-codes-add fix) behaves
// differently from Management/Production: it grants NO order visibility on its own —
// see join-department's comment. It's here so Back Ops staff have a real department to
// pick at all; they still need the Add a sales code / Add a customer code forms below to
// actually see anything.
export function JoinDepartmentForm() {
  const router = useRouter();
  const [department, setDepartment] = useState<SelfServiceDepartmentCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!department) {
      setError("Choose a department first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      await joinOwnDepartment(supabase, department);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join this department.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border-2 border-border p-5">
      <h2 className="text-sm font-semibold uppercase text-muted">Join a department</h2>
      <p className="text-xs text-muted">
        Management and Production see every order — no sales code needed. Back Ops just marks your department; add
        your sales code and/or customer code below to actually see anything. (Sales, Shipping, NAV, and QC Review
        aren&apos;t self-service yet; ask your admin for those.)
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Select
            label="Department"
            items={DEPARTMENT_OPTIONS.map((d) => ({ id: d.id, label: d.label }))}
            value={department}
            onChange={(value) => setDepartment((value as SelfServiceDepartmentCode) ?? null)}
            placeholder="Choose a department"
            fullWidth
          />
        </div>
        <Button type="submit" isPending={submitting}>
          Join
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
