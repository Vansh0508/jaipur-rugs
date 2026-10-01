import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in — JRGPT" };

const REASONS: Record<string, string> = {
  not_authorized: "Your account isn't active for this app. Ask your admin in Hub.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const notice = params.reason
    ? (REASONS[params.reason] ?? "Something went wrong. Please try again.")
    : null;

  return (
    <main className="jr-field mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-7 px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-medium font-bold text-background">
          JR
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">JRGPT</h1>
          <p className="mt-1 text-small text-default-500">
            Ask anything about sales, production, stock and customers.
          </p>
        </div>
      </div>

      {notice ? (
        <p className="rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-small text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
          {notice}
        </p>
      ) : null}

      <div className="rounded-2xl border border-default-200 bg-background p-6 shadow-sm">
        <LoginForm />
      </div>

      {/* Sign-up lives in Hub, not here: Hub owns the employees record and onboarding. One
          account, one place it is created — this app only recognises people who exist. */}
      <p className="text-center text-small text-default-500">
        New here?{" "}
        <a
          href="https://os.jaipurrugs.com/signup"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Create your account in Hub
        </a>
      </p>
      <p className="text-center text-tiny text-default-400">
        Same sign-in as Hub and Analytics — one account across every app.
      </p>
    </main>
  );
}
