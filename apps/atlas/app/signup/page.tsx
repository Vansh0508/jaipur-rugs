import Link from "next/link";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">Atlas — Create your account</h1>
        <p className="text-sm text-muted">
          For Jaipur Rugs staff and territory heads/B2B salespeople. Once created, an admin still needs to grant you
          access to the right department or customer codes.
        </p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in instead
        </Link>
      </p>
    </main>
  );
}
