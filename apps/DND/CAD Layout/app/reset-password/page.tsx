import { ResetPasswordForm } from "./ResetPasswordForm";

// Where a Supabase Auth recovery email's link lands (LoginForm.tsx's
// resetPasswordForEmail call sets redirectTo to this exact path). Unauthenticated-visitor
// page, same footing as /login and /signup — see proxy.ts's exemption for why this needs
// one too: exchanging the link's code establishes a real session, which would otherwise
// run into the normal active-employee check before the visitor can set a new password.
//
// `code` is read here as a server-side prop rather than via useSearchParams() in the
// client component, so that component doesn't need its own Suspense boundary.
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-muted">Choose a new password for your Jaipur Rugs account.</p>
      </div>
      <ResetPasswordForm code={params.code} />
    </main>
  );
}
