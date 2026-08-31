import type { ReactNode } from "react";
import "./globals.css";

// ClerkProvider is NOT here — it's scoped to app/merchant/layout.tsx only. Staff routes
// have nothing to do with Clerk at all; wrapping the whole app would make every staff
// page pull in Clerk's client bundle for no reason.
export const metadata = {
  title: "Atlas — Jaipur Rugs",
  description: "Unified order visibility: merchant, production, shipping, sales.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
