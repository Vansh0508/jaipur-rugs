import { TextField as HeroTextField, Label, Input, FieldError } from "@heroui/react";

export interface TextFieldProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: string;
  name?: string;
  placeholder?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  autoFocus?: boolean;
  className?: string;
  fullWidth?: boolean;
}

/**
 * Thin Hero UI v3 wrapper — v3's TextField is a compound component (TextField > Label,
 * Input), unlike v2's flat `<Input label="..." />`. This wrapper keeps call sites simple
 * (one component, a `label` prop) while composing the real v3 pieces underneath.
 */
export function TextField({
  label,
  value,
  onChange,
  type,
  name,
  placeholder,
  isRequired,
  isInvalid,
  errorMessage,
  autoFocus,
  className,
  fullWidth,
}: TextFieldProps) {
  return (
    <HeroTextField
      className={className}
      fullWidth={fullWidth}
      isInvalid={isInvalid}
      isRequired={isRequired}
      name={name}
      type={type as never}
      value={value}
      onChange={onChange}
    >
      {label ? <Label>{label}</Label> : null}
      <Input autoFocus={autoFocus} placeholder={placeholder} />
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </HeroTextField>
  );
}
