import {
  LayoutHeaderCellsLarge,
  Route,
  Calendar,
  Car,
  PersonWorker,
  Person,
  ArrowRightFromSquare,
  ChevronLeft,
} from "@gravity-ui/icons";

type IconProps = { className?: string };

const base = "shrink-0";

// Same icon for the same concept as apps/atlas/components/shell/icons.tsx and
// apps/hub/components/shell/icons.tsx (Dashboard, user menu, sign out, collapse toggle).
export function DashboardIcon({ className }: IconProps) {
  return <LayoutHeaderCellsLarge className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

export function JourneysIcon({ className }: IconProps) {
  return <Route className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

export function CarsIcon({ className }: IconProps) {
  return <Car className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

// PersonWorker, not Person — Person is already the signed-in user's icon in UserMenu.
export function DriversIcon({ className }: IconProps) {
  return <PersonWorker className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

// Conference room booking — the calendar is the feature's main surface.
export function ConferenceIcon({ className }: IconProps) {
  return <Calendar className={`${base} ${className ?? ""}`} width={20} height={20} />;
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
