import {
  ArrowRotateLeft,
  Ban,
  CalendarXmark,
  Car,
  CircleCheck,
  CirclePause,
  CloudArrowUpIn,
  EllipsisVertical,
  Eye,
  LayoutCells,
  ListUl,
  Pencil,
  TriangleExclamation,
  Wrench,
} from "@gravity-ui/icons";

// Page-level icons (view toggle, card tiles). Same wrapping convention as
// components/shell/icons.tsx — one named export per icon, never imported from
// @gravity-ui/icons directly at call sites.
type IconProps = { className?: string };

const base = "shrink-0";

export function TableViewIcon({ className }: IconProps) {
  return <ListUl className={`${base} ${className ?? ""}`} width={16} height={16} />;
}

export function CardViewIcon({ className }: IconProps) {
  return <LayoutCells className={`${base} ${className ?? ""}`} width={16} height={16} />;
}

export function CarTileIcon({ className }: IconProps) {
  return <Car className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

// Quick-action menu (components/shared/ActionsMenu.tsx and its callers).
export function MoreIcon({ className }: IconProps) {
  return <EllipsisVertical className={`${base} ${className ?? ""}`} width={16} height={16} />;
}

export function ViewIcon({ className }: IconProps) {
  return <Eye className={`${base} ${className ?? ""}`} width={16} height={16} />;
}

export function EditIcon({ className }: IconProps) {
  return <Pencil className={`${base} ${className ?? ""}`} width={16} height={16} />;
}

export function AvailableIcon({ className }: IconProps) {
  return <CircleCheck className={`${base} ${className ?? ""}`} width={16} height={16} />;
}

export function MaintenanceIcon({ className }: IconProps) {
  return <Wrench className={`${base} ${className ?? ""}`} width={16} height={16} />;
}

export function AccidentIcon({ className }: IconProps) {
  return <TriangleExclamation className={`${base} ${className ?? ""}`} width={16} height={16} />;
}

export function LeaveIcon({ className }: IconProps) {
  return <CalendarXmark className={`${base} ${className ?? ""}`} width={16} height={16} />;
}

export function SuspendIcon({ className }: IconProps) {
  return <CirclePause className={`${base} ${className ?? ""}`} width={16} height={16} />;
}

export function DeactivateIcon({ className }: IconProps) {
  return <Ban className={`${base} ${className ?? ""}`} width={16} height={16} />;
}

export function ReactivateIcon({ className }: IconProps) {
  return <ArrowRotateLeft className={`${base} ${className ?? ""}`} width={16} height={16} />;
}

export function UploadIcon({ className }: IconProps) {
  return <CloudArrowUpIn className={`${base} ${className ?? ""}`} width={24} height={24} />;
}
