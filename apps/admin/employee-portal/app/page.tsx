import { redirect } from "next/navigation";

// No login and no landing page — the portal opens straight on its first section.
export default function RootPage() {
  redirect("/journey-booking");
}
