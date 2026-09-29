import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { env } from "@/lib/env";
import { cookies } from "next/headers";
import { DEMO_COOKIE, getDemoSession } from "@/lib/demoAuth";

const ERROR_MESSAGES: Record<string, string> = {
  not_authorized: "Your account isn't set up for Sketch Challan yet. Contact your admin.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (env.demoMode) {
    const cookieStore = await cookies();
    if (getDemoSession(cookieStore.get(DEMO_COOKIE)?.value)) redirect("/");
  }
  const params = await searchParams;
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] ?? "Something went wrong. Please try again." : null;

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">Sketch Challan — Staff sign in</h1>
        <p className="text-sm text-muted">{env.demoMode ? "Use your temporary Sketch Challan login." : "Use your existing Hub account."}</p>
      </div>
      {errorMessage ? (
        <p className="rounded-lg border-2 border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{errorMessage}</p>
      ) : null}
      <LoginForm demoMode={env.demoMode} />
      </div>
    </main>
  );
}
