import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Employee Portal — Jaipur Rugs",
  description: "Request a journey or a conference room.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
