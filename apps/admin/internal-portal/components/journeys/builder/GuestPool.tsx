"use client";

import { useEffect, useRef, useState } from "react";
import { Label, ListBox, Select, Tooltip, type Key } from "@heroui/react";
import { Button, PhoneInput, TextField } from "@jaipur-rugs/ui-kit";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { searchGuestCandidates, type GuestCandidate } from "@/lib/queries/guests";
import { searchEmployeeCandidates, type EmployeeCandidate } from "@/lib/queries/employees";
import { LABEL_CLS } from "./fields";
import { emptyGuest, type PoolGuest } from "./model";

// driver-app-new's "Guests Pool" overlay + GuestAutocomplete: every guest on the journey
// is entered once here (phone + name, both searching existing guests), then picked per
// stop below. Choosing a suggestion links the existing `guests` row (create_journey
// matches on it); a new phone creates a guest when the journey is saved. Each row starts with
// a Guest/Employee dropdown (Employee by default): an employee is picked from the employees
// directory (by name or employee code) and linked as-is — no guest copy, and no phone needed
// (most have none).

function useGuestSuggestions(term: string, enabled: boolean) {
  const [results, setResults] = useState<GuestCandidate[]>([]);
  useEffect(() => {
    const q = term.trim();
    if (!enabled || q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setResults(await searchGuestCandidates(getBrowserSupabaseClient(), q));
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [term, enabled]);
  return results;
}

function SuggestionList({ items, onPick }: { items: GuestCandidate[]; onPick: (g: GuestCandidate) => void }) {
  return (
    <ul className="absolute left-0 right-0 z-[100] mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
      {items.map((g) => (
        <li key={g.id}>
          <button
            type="button"
            // onMouseDown so the pick lands before the input's blur hides the list
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(g);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-secondary"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-[10px] font-semibold">
              {g.fullName[0]?.toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold text-foreground">{g.fullName}</span>
              <span className="block truncate text-[10px] text-muted tabular-nums">{g.phone}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function GuestRow({ guest, onChange }: { guest: PoolGuest; onChange: (g: PoolGuest) => void }) {
  const [focus, setFocus] = useState<"phone" | "name" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // PhoneInput reads its value only on mount — remount it when a suggestion replaces the number.
  const [phoneKey, setPhoneKey] = useState(0);
  const phoneDigits = guest.phone.replace(/^\+\d{1,3}/, "");
  const phoneMatches = useGuestSuggestions(phoneDigits, focus === "phone" && !guest.guestId);
  const nameMatches = useGuestSuggestions(guest.name, focus === "name" && !guest.guestId);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setFocus(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pick(g: GuestCandidate) {
    onChange({ ...guest, guestId: g.id, name: g.fullName, phone: g.phone });
    setPhoneKey((k) => k + 1);
    setFocus(null);
  }

  return (
    <div ref={containerRef} className="grid flex-1 items-start gap-3 sm:grid-cols-2">
      <div className="relative" onFocus={() => setFocus("phone")}>
        <PhoneInput
          key={phoneKey}
          label="Phone number"
          value={guest.phone}
          onChange={(phone) => onChange({ ...guest, guestId: null, phone })}
          isRequired
        />
        {focus === "phone" && phoneMatches.length > 0 ? <SuggestionList items={phoneMatches} onPick={pick} /> : null}
      </div>
      <div className="relative" onFocus={() => setFocus("name")}>
        <TextField
          label="Guest name"
          value={guest.name}
          onChange={(name) => onChange({ ...guest, guestId: null, name })}
          isRequired
          fullWidth
        />
        {focus === "name" && nameMatches.length > 0 ? <SuggestionList items={nameMatches} onPick={pick} /> : null}
      </div>
    </div>
  );
}

function useEmployeeSuggestions(term: string, enabled: boolean) {
  const [results, setResults] = useState<EmployeeCandidate[]>([]);
  useEffect(() => {
    const q = term.trim();
    if (!enabled || q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setResults(await searchEmployeeCandidates(getBrowserSupabaseClient(), q));
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [term, enabled]);
  return results;
}

function EmployeeRow({ guest, onChange }: { guest: PoolGuest; onChange: (g: PoolGuest) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const matches = useEmployeeSuggestions(query, open && !guest.employeeId);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (guest.employeeId) {
    const initials = guest.name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    return (
      <div>
        {/* Same label row as the search field, so it lines up with the Guest/Employee dropdown. */}
        <span className={LABEL_CLS}>Employee</span>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary/40 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{guest.name}</p>
            <p className="truncate text-xs text-muted">
              <span className="tracking-wide tabular-nums">{guest.employeeCode}</span>
              {guest.departmentName ? ` · ${guest.departmentName}` : ""}
              {" · "}
              <span className="tabular-nums">{guest.phone || "No phone on file"}</span>
            </p>
          </div>
          <Button size="sm" variant="ghost" onPress={() => onChange({ ...emptyGuest("employee"), clientId: guest.clientId })}>
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative" onFocus={() => setOpen(true)}>
      <TextField label="Employee" value={query} onChange={setQuery} placeholder="Search by name or employee code" isRequired fullWidth />
      {open && matches.length > 0 ? (
        <ul className="absolute left-0 right-0 z-[100] mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
          {matches.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  onChange({
                    ...guest,
                    employeeId: e.id,
                    employeeCode: e.employeeCode,
                    departmentName: e.departmentName,
                    name: e.fullName,
                    phone: e.phone ?? "",
                  });
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-secondary"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-[10px] font-semibold">
                  {e.fullName[0]?.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-foreground">{e.fullName}</span>
                  <span className="block truncate text-[10px] text-muted">
                    <span className="tabular-nums">{e.employeeCode}</span>
                    {e.departmentName ? ` · ${e.departmentName}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim().length >= 2 && matches.length === 0 ? (
        <p className="mt-1 text-[11px] text-muted">No active employee matches “{query.trim()}”.</p>
      ) : null}
    </div>
  );
}

const KIND_OPTIONS: { id: PoolGuest["kind"]; label: string }[] = [
  { id: "employee", label: "Employee" },
  { id: "guest", label: "Guest" },
];

/**
 * The row's Guest/Employee dropdown. Hero UI's Select directly rather than ui-kit's wrapper,
 * which has no disabled state — the row is locked while the passenger is on the route.
 */
function KindSelect({ kind, isDisabled, onChange }: { kind: PoolGuest["kind"]; isDisabled: boolean; onChange: (kind: PoolGuest["kind"]) => void }) {
  return (
    <Select
      className="w-36 shrink-0"
      value={kind}
      isDisabled={isDisabled}
      onChange={(key: Key | Key[] | null) => key != null && !Array.isArray(key) && onChange(String(key) as PoolGuest["kind"])}
    >
      <Label>Guest/Employee</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {KIND_OPTIONS.map((option) => (
            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function GuestPoolEditor({
  pool,
  errors,
  isInRoute,
  onChange,
  onAdd,
  onRemove,
  onCancel,
  onSave,
}: {
  pool: PoolGuest[];
  errors: Record<string, string>;
  isInRoute: (clientId: string) => boolean;
  onChange: (guest: PoolGuest) => void;
  onAdd: () => void;
  onRemove: (clientId: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-surface p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
        <h3 className="text-sm font-semibold text-foreground">Guests pool</h3>
        <button type="button" onClick={onCancel} aria-label="Close guests pool" className="rounded-lg p-1.5 text-muted hover:bg-surface-secondary">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      </div>

      {pool.length === 0 ? (
        <div className="mb-4 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-6 text-center">
          <p className="text-xs text-muted">No guests added. Click &quot;Add another guest&quot; below.</p>
        </div>
      ) : (
        <div className="mb-4 divide-y divide-border rounded-xl border border-border">
          {pool.map((guest) => {
            const inRoute = isInRoute(guest.clientId);
            const remove = (
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                aria-label="Remove guest"
                isDisabled={inRoute}
                onPress={() => onRemove(guest.clientId)}
                className="text-muted hover:text-danger"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 2l10 10M12 2L2 12" />
                </svg>
              </Button>
            );
            return (
              <div key={guest.clientId} className="flex items-start gap-3 p-3">
                <KindSelect
                  kind={guest.kind}
                  isDisabled={inRoute}
                  onChange={(kind) => kind !== guest.kind && onChange({ ...emptyGuest(kind), clientId: guest.clientId })}
                />
                <div className="min-w-0 flex-1">
                  {guest.kind === "employee" ? <EmployeeRow guest={guest} onChange={onChange} /> : <GuestRow guest={guest} onChange={onChange} />}
                  {errors[`guest_${guest.clientId}`] ? (
                    <p className="mt-1 pl-1 text-[11px] text-danger">{errors[`guest_${guest.clientId}`]}</p>
                  ) : null}
                </div>
                {/* Below the label row, level with the inputs. */}
                <div className="shrink-0 pt-7">
                  {inRoute ? (
                    <Tooltip delay={0} closeDelay={0}>
                      <Tooltip.Trigger>
                        <span className="inline-block">{remove}</span>
                      </Tooltip.Trigger>
                      <Tooltip.Content className="max-w-[280px] p-2 text-xs">
                        This guest is assigned to a stop in the route plan. Remove them from the route first to delete.
                      </Tooltip.Content>
                    </Tooltip>
                  ) : (
                    remove
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button size="sm" variant="ghost" onPress={onAdd}>
          + Add another guest
        </Button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onPress={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onPress={onSave}>
            Save guests
          </Button>
        </div>
      </div>
    </div>
  );
}
