import type { Enums } from "@jaipur-rugs/supabase-client";

// Display labels for every fuel_type value (db/journeys/009 widened the enum from 3 to 11,
// matching driver-app-new's list). A Record over the enum, so a future value added to
// the DB fails type-check here instead of rendering a raw snake_case key.
export const FUEL_LABEL: Record<Enums<"fuel_type">, string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  ev: "EV",
  cng: "CNG",
  hybrid: "Hybrid",
  lpg: "LPG",
  biodiesel: "Biodiesel",
  hydrogen: "Hydrogen",
  petrol_cng: "Petrol + CNG",
  petrol_lpg: "Petrol + LPG",
  ev_petrol: "EV + Petrol",
};
