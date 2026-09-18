import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "CAD Layout — Jaipur Rugs DnD",
  description: "Tikni BMP to B2C / JLI / B2B layout deck (PPTX + PDF).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
