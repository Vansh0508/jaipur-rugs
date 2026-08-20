import type { Key } from "@heroui/react";
import { Select as HeroSelect, Label, ListBox, FieldError } from "@heroui/react";

export interface SelectOption {
  id: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  items: SelectOption[];
  value?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  className?: string;
  fullWidth?: boolean;
}

/**
 * Thin Hero UI v3 wrapper — v3's Select is a compound component (Select > Trigger/Value/
 * Popover > ListBox > Item), unlike a flat `<select>`. This wrapper keeps call sites simple
 * (one component, an `items` prop) while composing the real v3 pieces underneath, matching
 * TextField.tsx's wrapper style. Single-select only — nothing in this repo needs multi-select yet.
 */
export function Select({
  label,
  items,
  value,
  onChange,
  placeholder,
  isRequired,
  isInvalid,
  errorMessage,
  className,
  fullWidth,
}: SelectProps) {
  return (
    <HeroSelect
      className={className}
      fullWidth={fullWidth}
      isInvalid={isInvalid}
      isRequired={isRequired}
      placeholder={placeholder}
      value={value ?? null}
      onChange={(key: Key | Key[] | null) => onChange?.(key == null ? null : String(key))}
    >
      {label ? <Label>{label}</Label> : null}
      <HeroSelect.Trigger>
        <HeroSelect.Value />
        <HeroSelect.Indicator />
      </HeroSelect.Trigger>
      <HeroSelect.Popover>
        <ListBox>
          {items.map((item) => (
            <ListBox.Item key={item.id} id={item.id} textValue={item.label}>
              {item.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </HeroSelect.Popover>
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </HeroSelect>
  );
}
