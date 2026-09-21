"use client";

import { useId } from "react";

interface ComboFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  isRequired?: boolean;
}

/**
 * Text input with a `<datalist>` of the standard values — a dropdown that still accepts a
 * typed value. The meeting's rule: standard fields get dropdowns, free text stays editable;
 * the option lists themselves are provisional until DnD's reference folder arrives, so
 * blocking on "not in the list" would be wrong.
 */
export function ComboField({ label, value, onChange, options, placeholder, isRequired }: ComboFieldProps) {
  const inputId = useId();
  const listId = `${inputId}-list`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={inputId}
        list={listId}
        value={value}
        required={isRequired}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-lg border-2 border-border bg-transparent px-3 text-sm outline-none transition-colors focus:border-accent"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}
