"use client";

import { useEffect, useRef, useState } from "react";
import { Input, Label, TextField as HeroTextField } from "@heroui/react";
import { TextField } from "@jaipur-rugs/ui-kit";
import { lookupEmployeeByCode, type PublicEmployee } from "@jaipur-rugs/db-management-client";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { FieldError } from "@/components/journey/fields";

// "Employee ID" — how a request says who it's from, since this portal has no login. Looked up
// as it's typed (employee-lookup-by-code: exact code, active employees only) and shown back as
// name + department, the same way the admin's conference form fills them in. The last code
// used is remembered on this device, so a regular doesn't retype it.

export type EmployeeLookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "found"; employee: PublicEmployee }
  | { state: "notfound" }
  | { state: "error" };

const STORAGE_KEY = "employee-portal:employeeCode";

/** Debounced lookup; a late answer for an older code is dropped so it can't overwrite a newer one. */
export function useEmployeeLookup(code: string): EmployeeLookup {
  const [lookup, setLookup] = useState<EmployeeLookup>({ state: "idle" });
  const token = useRef(0);
  useEffect(() => {
    const trimmed = code.trim();
    const mine = ++token.current;
    if (!trimmed) {
      setLookup({ state: "idle" });
      return;
    }
    setLookup({ state: "loading" });
    const timer = setTimeout(async () => {
      try {
        const employee = await lookupEmployeeByCode(getSupabaseClient(), trimmed);
        if (mine !== token.current) return;
        setLookup(employee ? { state: "found", employee } : { state: "notfound" });
      } catch {
        if (mine === token.current) setLookup({ state: "error" });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [code]);
  return lookup;
}

/** The requester's code, starting from the one remembered on this device. */
export function useRememberedEmployeeCode(): [string, (code: string) => void, () => void] {
  const [code, setCode] = useState("");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setCode(stored);
    } catch {
      // Storage unavailable — just start empty.
    }
  }, []);
  function remember() {
    try {
      window.localStorage.setItem(STORAGE_KEY, code.trim());
    } catch {
      // Storage unavailable — nothing to remember.
    }
  }
  return [code, setCode, remember];
}

/** The problem with the lookup as a sentence, or null when it's an active employee. */
export function lookupProblem(lookup: EmployeeLookup, code: string): string | null {
  if (!code.trim()) return "Enter your employee ID.";
  if (lookup.state === "loading" || lookup.state === "idle") return "Still looking up your employee ID — one moment.";
  if (lookup.state === "notfound") return "No active employee has that employee ID.";
  if (lookup.state === "error") return "Couldn't check your employee ID. Try again.";
  return null;
}

function ReadOnlyField({ label, value, placeholder }: { label: string; value: string; placeholder: string }) {
  return (
    <HeroTextField fullWidth isReadOnly value={value}>
      <Label>{label}</Label>
      <Input placeholder={placeholder} />
    </HeroTextField>
  );
}

export function EmployeeCodeField({
  code,
  onChange,
  lookup,
  showDetails = true,
}: {
  code: string;
  onChange: (code: string) => void;
  lookup: EmployeeLookup;
  /** Name + department fields below the code (the conference form); off for a compact spot. */
  showDetails?: boolean;
}) {
  const employee = lookup.state === "found" ? lookup.employee : null;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <TextField label="Your employee ID" value={code} onChange={onChange} placeholder="e.g. your employee code" isRequired fullWidth />
        {lookup.state === "loading" ? <p className="mt-1 text-xs text-muted">Looking up…</p> : null}
        {lookup.state === "found" && !showDetails ? (
          <p className="mt-1 text-xs text-success">
            {lookup.employee.fullName}
            {lookup.employee.departmentName ? ` · ${lookup.employee.departmentName}` : ""}
          </p>
        ) : null}
        {lookup.state === "notfound" ? <FieldError msg="No active employee has this ID." /> : null}
        {lookup.state === "error" ? <FieldError msg="Couldn't look up this ID. Try again." /> : null}
      </div>
      {showDetails ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReadOnlyField label="Name" value={employee?.fullName ?? ""} placeholder="Filled in from your employee ID" />
          <ReadOnlyField label="Department" value={employee ? (employee.departmentName ?? "—") : ""} placeholder="Filled in from your employee ID" />
        </div>
      ) : null}
    </div>
  );
}
