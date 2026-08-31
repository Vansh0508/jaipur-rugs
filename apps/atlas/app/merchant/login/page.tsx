import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SignIn } from "@clerk/nextjs";

export default async function MerchantLoginPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/merchant/orders");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Atlas — Merchant sign in</h1>
        <p className="text-sm text-muted">Check your order status directly, any time.</p>
      </div>
      <SignIn routing="hash" forceRedirectUrl="/merchant/orders" />
    </main>
  );
}
