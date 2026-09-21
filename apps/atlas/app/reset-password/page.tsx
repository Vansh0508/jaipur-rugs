import { ResetPasswordForm } from "./ResetPasswordForm";

// Where a Supabase Auth recovery email's link lands (LoginForm.tsx's
// resetPasswordForEmail call sets redirectTo to this exact path). Unauthenticated-
// visitor page, same footing as /login/(signup — see proxy.ts's exemption for why this
// needs one too: exchanging the link's code below establishes a real session, which
// would otherwise run straight into the normal employee/authorization checks before the
// visitor ever gets to actually set a new password.
//
// `code` is read here (a server-side prop, same pattern LoginPage's own searchParams
// already uses) rather than via useSearchParams() in the client component, so that
// component doesn't need its own Suspense boundary.
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-muted">Choose a new password for your Atlas account.</p>
      </div>
      <ResetPasswordForm code={params.code} />
    </main>
  );
}
