import { Button as HeroButton, type ButtonProps as HeroButtonProps } from "@heroui/react";

export type ButtonProps = HeroButtonProps;

/** Thin Hero UI v3 wrapper so every app imports a button from one place (AGENTS.md Section 4). */
export function Button(props: ButtonProps) {
  return <HeroButton {...props} />;
}
