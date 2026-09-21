"use client";

import { useRouter } from "next/navigation";
import { Button } from "@jaipur-rugs/ui-kit";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

export function UserMenu({ fullName }: { fullName: string }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mt-auto flex items-center justify-between gap-2 border-t-2 border-border p-4">
      <span className="truncate text-sm text-muted" title={fullName}>
        {fullName}
      </span>
      <Button variant="tertiary" size="sm" onPress={handleSignOut}>
        Sign out
      </Button>
    </div>
  );
}
