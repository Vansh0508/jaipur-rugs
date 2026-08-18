"use client";

import { useState } from "react";
import { Select, ListBox } from "@heroui/react";
import { TextField } from "./TextField";
import { COUNTRY_DIAL_CODES, DEFAULT_COUNTRY_DIAL_CODE } from "./countryDialCodes";

export interface PhoneInputProps {
  /** Full E.164 value, e.g. "+919812345678". Empty string until a number is entered. */
  value: string;
  onChange: (e164: string) => void;
  label?: string;
  isRequired?: boolean;
}

/**
 * Country-code + local-number phone input. Guests must supply a phone with a country
 * code (mandatory per the Feedback App plan) — this is the one place that composition
 * happens, so both the login form and any future app needing a phone field reuse it.
 */
export function PhoneInput({ value, onChange, label = "Phone number", isRequired }: PhoneInputProps) {
  const initialDialIso2 = COUNTRY_DIAL_CODES.find((c) => value.startsWith(c.dialCode))?.iso2 ?? DEFAULT_COUNTRY_DIAL_CODE.iso2;
  const [dialIso2, setDialIso2] = useState(initialDialIso2);
  const [localNumber, setLocalNumber] = useState(() => {
    const dial = COUNTRY_DIAL_CODES.find((c) => c.iso2 === initialDialIso2)!;
    return value.startsWith(dial.dialCode) ? value.slice(dial.dialCode.length) : value;
  });

  function emit(nextDialIso2: string, nextLocalNumber: string) {
    const dial = COUNTRY_DIAL_CODES.find((c) => c.iso2 === nextDialIso2) ?? DEFAULT_COUNTRY_DIAL_CODE;
    const digits = nextLocalNumber.replace(/[^\d]/g, "");
    onChange(digits ? `${dial.dialCode}${digits}` : "");
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label ? <span className="text-sm font-medium text-foreground">{label}</span> : null}
      <div className="flex gap-2">
        <Select
          aria-label="Country code"
          className="w-28 shrink-0"
          value={dialIso2}
          onChange={(key) => {
            const iso2 = String(key);
            setDialIso2(iso2);
            emit(iso2, localNumber);
          }}
        >
          <Select.Trigger>
            <Select.Value>
              {({ isPlaceholder, state, defaultChildren }) => {
                if (isPlaceholder) return defaultChildren;
                const selectedIso2 = state.selectedItems[0]?.key as string | undefined;
                const dial = COUNTRY_DIAL_CODES.find((c) => c.iso2 === selectedIso2);
                return dial ? dial.dialCode : defaultChildren;
              }}
            </Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {COUNTRY_DIAL_CODES.map((c) => (
                <ListBox.Item key={c.iso2} id={c.iso2} textValue={`${c.name} ${c.dialCode}`}>
                  {c.dialCode} {c.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <TextField
          className="flex-1"
          isRequired={isRequired}
          type="tel"
          value={localNumber}
          onChange={(next) => {
            setLocalNumber(next);
            emit(dialIso2, next);
          }}
        />
      </div>
    </div>
  );
}
