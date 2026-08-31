import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { env } from "@/lib/env";

const ERROR_MESSAGES: Record<string, string> = {
  not_authorized: "Your account isn't set up for Atlas yet. Contact your admin.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] ?? "Something went wrong. Please try again." : null;
  const hubSignupUrl = env.hubUrl ? `${env.hubUrl}/signup` : "/signup";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">Atlas — Staff sign in</h1>
        <p className="text-sm text-muted">Production, shipping, sales, and admin views.</p>
      </div>
      {errorMessage ? (
        <p className="rounded-lg border-2 border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{errorMessage}</p>
      ) : null}
      <LoginForm />
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href={hubSignupUrl} className="font-medium text-accent hover:underline">
          Create your account via Hub
        </Link>
      </p>
      <p className="text-center text-sm text-muted">
        Merchant?{" "}
        <Link href="/merchant/login" className="font-medium text-accent hover:underline">
          Sign in here instead
        </Link>
      </p>
    </main>
  );
}
