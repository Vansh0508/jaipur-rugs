import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Sketch Challan — Jaipur Rugs",
  description: "Digital Sketch Challan intake, delegation and history.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
