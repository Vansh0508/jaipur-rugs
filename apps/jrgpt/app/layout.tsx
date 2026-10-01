import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "JRGPT — Jaipur Rugs",
  description: "Ask anything about sales, production, stock and customers.",
};

/**
 * HeroUI v3 keys its dark tokens off a `dark` class, not the media query alone, so the
 * class has to be set before first paint or the page flashes light. Runs inline, ahead of
 * hydration; wrapped because storage access throws in some privacy modes.
 */
const THEME_BOOTSTRAP = `
(function () {
  try {
    var stored = localStorage.getItem("jrgpt-theme");
    var dark = stored ? stored === "dark"
                      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {
    /* no storage - fall back to the media query result already applied by CSS */
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-screen bg-default-50 text-foreground antialiased">{children}</body>
    </html>
  );
}
