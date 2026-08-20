import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { getOwnProfile } from "@/lib/queries/employees";
import { listDepartments } from "@/lib/queries/departments";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default async function ProfilePage() {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Shell layout's requireHubAccess() already guarantees a matching active employee row
  // exists — this can't legitimately be null here.
  const [profile, departments] = await Promise.all([getOwnProfile(supabase, user!.id), listDepartments(supabase)]);

  return (
    <div>
      <PageHeader title="Profile" description="Your details, visible to your manager and department." />
      <ProfileForm profile={profile!} departments={departments} />
    </div>
  );
}
