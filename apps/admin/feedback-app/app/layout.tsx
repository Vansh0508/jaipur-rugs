import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Driver Feedback — Jaipur Rugs",
  description: "Rate your trip with our in-house drivers.",
};

// Hero UI v3 needs no Provider — components work directly after installation and the
// style import in globals.css.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
