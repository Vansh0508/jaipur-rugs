import { LoginForm } from "./LoginForm";

const ERROR_MESSAGES: Record<string, string> = {
  not_authorized: "Your account isn't an active employee account. Contact your admin.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] ?? "Something went wrong. Please try again." : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">CAD Layout</h1>
        <p className="text-sm text-muted">Sign in with your Jaipur Rugs employee account.</p>
      </div>
      {errorMessage ? (
        <p className="rounded-lg border-2 border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{errorMessage}</p>
      ) : null}
      <LoginForm />
    </main>
  );
}
