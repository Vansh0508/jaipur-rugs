import { Person, Persons, Sliders, ArrowRightFromSquare, ChevronLeft } from "@gravity-ui/icons";

type IconProps = { className?: string };

const base = "shrink-0";

export function ProfileIcon({ className }: IconProps) {
  return <Person className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

export function TeamIcon({ className }: IconProps) {
  return <Persons className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

export function DependenciesIcon({ className }: IconProps) {
  return <Sliders className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

export function UserIcon({ className }: IconProps) {
  return <Person className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

export function SignOutIcon({ className }: IconProps) {
  return <ArrowRightFromSquare className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

export function ChevronIcon({ className }: IconProps) {
  return <ChevronLeft className={`${base} ${className ?? ""}`} width={20} height={20} />;
}
