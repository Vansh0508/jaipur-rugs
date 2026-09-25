import Link from "next/link";
import { SignupForm } from "./SignupForm";

// Unauthenticated-visitor page — a brand-new person has no session by definition, so
// proxy.ts exempts this path (same exemption /login and /reset-password get).
export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted">
          One Jaipur Rugs account works across CAD Layout, Atlas and the other internal tools.
        </p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
