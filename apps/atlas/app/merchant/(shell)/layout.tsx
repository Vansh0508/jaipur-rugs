import type { ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { requireMerchantAccess } from "@/lib/merchant/requireMerchantAccess";

// Deliberately the most restrained shell in this app (build prompt Section 1.1 —
// merchant-facing views should be the most restrained of all; an external contact
// judging the company by this screen is a real consideration). No sidebar, no admin
// affordances, just a header and the order list/detail.
export default async function MerchantShellLayout({ children }: { children: ReactNode }) {
  const access = await requireMerchantAccess();

  if (access.status === "no_record") {
    return (
      <MerchantMessage
        title="We don't have an account set up for you yet"
        body="Contact your Jaipur Rugs representative to get set up for order tracking."
      />
    );
  }
  if (access.status === "conflict") {
    return (
      <MerchantMessage
        title="This account is already linked elsewhere"
        body="Contact your Jaipur Rugs representative if you believe this is a mistake."
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between border-b-2 border-border pb-4">
        <Link href="/merchant/orders" className="text-lg font-semibold text-foreground">
          Jaipur Rugs — Order Status
        </Link>
        <UserButton afterSignOutUrl="/merchant/login" />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

function MerchantMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted">{body}</p>
    </main>
  );
}
