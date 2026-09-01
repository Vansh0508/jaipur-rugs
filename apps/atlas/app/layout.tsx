import type { ReactNode } from "react";
import "./globals.css";

// One auth system, Supabase Auth throughout — see proxy.ts's comment. Atlas briefly had
// a second, Clerk-based login for "merchants" (apps/atlas/app/merchant/*, removed
// 2026-09-01) before it became clear those are internal salespeople, not external
// customers — no ClerkProvider anywhere in this app anymore.
export const metadata = {
  title: "Atlas — Jaipur Rugs",
  description: "Unified order visibility: territory sales, production, shipping, admin.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
