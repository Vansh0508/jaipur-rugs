"use client";

import { useEffect, useState } from "react";
import { Label, ListBox, Select, Tooltip, type Key } from "@heroui/react";
import { Button, PhoneInput, TextField } from "@jaipur-rugs/ui-kit";
import { useEmployeeLookup } from "@/components/shared/EmployeeCodeField";
import { LABEL_CLS } from "./fields";
import { emptyGuest, type PoolGuest } from "./model";

// The "Guests pool" overlay from apps/admin/internal-portal's journey builder: every passenger
// is entered once here, then picked per stop below. Each row starts with a Guest/Employee
// dropdown (Employee by default).
// Two differences, because this portal has no login: a guest is typed in (name + phone) with
// no search of existing guests — that directory holds other people's phone numbers — and an
// employee is found by their exact employee ID, not by searching names.

function GuestRow({ guest, onChange }: { guest: PoolGuest; onChange: (g: PoolGuest) => void }) {
  return (
    <div className="grid flex-1 items-start gap-3 sm:grid-cols-2">
      <PhoneInput label="Phone number" value={guest.phone} onChange={(phone) => onChange({ ...guest, phone })} isRequired />
      <TextField label="Guest name" value={guest.name} onChange={(name) => onChange({ ...guest, name })} isRequired fullWidth />
    </div>
  );
}

function EmployeeRow({ guest, onChange }: { guest: PoolGuest; onChange: (g: PoolGuest) => void }) {
  const [code, setCode] = useState("");
  const lookup = useEmployeeLookup(guest.employeeId ? "" : code);

  // An exact match fills the row in straight away — there's nothing else to pick from.
  useEffect(() => {
    if (lookup.state !== "found" || guest.employeeId) return;
    const e = lookup.employee;
    onChange({ ...guest, employeeId: e.id, employeeCode: e.employeeCode, departmentName: e.departmentName, name: e.fullName, phone: "" });
    setCode("");
  }, [lookup, guest, onChange]);

  if (guest.employeeId) {
    const initials = guest.name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    return (
      <div>
        {/* Same label row as the ID field, so it lines up with the Guest/Employee dropdown. */}
        <span className={LABEL_CLS}>Employee</span>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary/40 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{guest.name}</p>
            <p className="truncate text-xs text-muted">
              <span className="tracking-wide tabular-nums">{guest.employeeCode}</span>
              {guest.departmentName ? ` · ${guest.departmentName}` : ""}
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
    <div>
      <TextField label="Employee ID" value={code} onChange={setCode} placeholder="Their employee code" isRequired fullWidth />
      {lookup.state === "loading" ? <p className="mt-1 text-[11px] text-muted">Looking up…</p> : null}
      {lookup.state === "notfound" ? <p className="mt-1 text-[11px] text-muted">No active employee has the ID “{code.trim()}”.</p> : null}
      {lookup.state === "error" ? <p className="mt-1 text-[11px] text-danger">Couldn&apos;t look up this ID. Try again.</p> : null}
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
          <p className="text-xs text-muted">No passengers added. Click &quot;Add another guest&quot; below.</p>
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
                  {errors[`guest_${guest.clientId}`] ? <p className="mt-1 pl-1 text-[11px] text-danger">{errors[`guest_${guest.clientId}`]}</p> : null}
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
