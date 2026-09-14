import {
  LayoutHeaderCellsLarge,
  ShoppingBag,
  Bell,
  Persons,
  Eye,
  Key,
  Person,
  ArrowRightFromSquare,
  ChevronLeft,
} from "@gravity-ui/icons";

type IconProps = { className?: string };

const base = "shrink-0";

export function DashboardIcon({ className }: IconProps) {
  return <LayoutHeaderCellsLarge className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

export function OrdersIcon({ className }: IconProps) {
  return <ShoppingBag className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

export function AlertsIcon({ className }: IconProps) {
  return <Bell className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

export function MerchantsIcon({ className }: IconProps) {
  return <Persons className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

export function RugLensIcon({ className }: IconProps) {
  return <Eye className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

export function AccessIcon({ className }: IconProps) {
  return <Key className={`${base} ${className ?? ""}`} width={20} height={20} />;
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
