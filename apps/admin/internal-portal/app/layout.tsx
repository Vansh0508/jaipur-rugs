import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Internal Portal — Jaipur Rugs",
  description: "Journeys, cars, and drivers — admin-only.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
