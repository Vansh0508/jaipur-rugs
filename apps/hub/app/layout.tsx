import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Hub — Jaipur Rugs",
  description: "Sign up, sign in, onboarding, profile, and team administration.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
