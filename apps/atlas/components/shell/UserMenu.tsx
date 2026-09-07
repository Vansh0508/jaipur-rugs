"use client";

import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { SignOutIcon, UserIcon } from "./icons";

// Icon-first: the avatar icon stays visible at the sidebar's collapsed 64px width (see
// (shell)/layout.tsx's comment), name + sign-out fade in together with the rest of the
// panel on hover, same `group-hover/sidebar:` pattern SidebarNav.tsx uses. Sign-out
// itself is a plain icon button rather than ui-kit's <Button> while collapsed — that
// component's own padding/label layout doesn't have an icon-only mode, and this needs
// to stay a fixed, small square regardless of expand state.
export function UserMenu({ fullName }: { fullName: string }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 overflow-hidden border-b-2 border-border p-4">
      <UserIcon className="h-6 w-6 shrink-0 text-muted" />
      <span
        className="min-w-0 flex-1 truncate whitespace-nowrap text-sm text-muted opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100"
        title={fullName}
      >
        {fullName}
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        title="Sign out"
        aria-label="Sign out"
        className="shrink-0 rounded-lg p-1.5 text-muted opacity-0 transition-opacity duration-150 hover:bg-surface-secondary hover:text-foreground group-hover/sidebar:opacity-100"
      >
        <SignOutIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
