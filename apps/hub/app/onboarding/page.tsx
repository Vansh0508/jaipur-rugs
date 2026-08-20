import { redirect } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { listDepartments } from "@/lib/queries/departments";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

// No requireHubAccess() re-check here on purpose — that helper redirects TO /onboarding
// when it's incomplete, so calling it from the onboarding page itself would be circular.
// The only things this page needs to confirm are "there's a session" and "there's an
// employee row" (proxy.ts already gated on both); it deliberately does not care whether
// onboarding is already complete — a completed employee never lands here in the first
// place per proxy.ts's redirect rules.
export default async function OnboardingPage() {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase.from("employees").select("full_name").eq("auth_user_id", user.id).maybeSingle();
  if (!employee) {
    redirect("/api/force-logout?reason=not_authorized");
  }

  const departments = await listDepartments(supabase);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">Welcome, {employee!.full_name.split(" ")[0]}</h1>
        <p className="text-sm text-muted">A few details before you get started.</p>
      </div>
      <OnboardingWizard departments={departments} />
    </main>
  );
}
