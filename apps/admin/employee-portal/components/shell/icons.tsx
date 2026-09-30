import { Calendar, ChevronLeft, Route } from "@gravity-ui/icons";

type IconProps = { className?: string };

const base = "shrink-0";

// Same icon for the same concept as apps/admin/internal-portal/components/shell/icons.tsx:
// Route for journeys, Calendar for the conference rooms, ChevronLeft for the collapse toggle.
export function JourneyBookingIcon({ className }: IconProps) {
  return <Route className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

export function ConferenceBookingIcon({ className }: IconProps) {
  return <Calendar className={`${base} ${className ?? ""}`} width={20} height={20} />;
}

export function ChevronIcon({ className }: IconProps) {
  return <ChevronLeft className={`${base} ${className ?? ""}`} width={20} height={20} />;
}
