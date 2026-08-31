import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

// Scoped to /merchant/* only — see proxy.ts's comment for why ClerkProvider isn't in
// the root layout (app/layout.tsx already provides the one allowed <html>/<body> for
// this whole app; this nested layout just adds the provider around its subtree).
export default function MerchantLayout({ children }: { children: ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
