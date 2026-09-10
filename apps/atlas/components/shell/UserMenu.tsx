"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popover, AlertDialog, Button } from "@jaipur-rugs/ui-kit";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { SignOutIcon, UserIcon } from "./icons";

// Moved to the bottom of the sidebar column, 2026-09-10 (was pinned to the top) —
// profile controls read more naturally as the last item in a nav list, and it frees the
// top of the sidebar for the "Atlas" wordmark + collapse toggle (see SidebarNav.tsx).
//
// Rebuilt around Hero UI's Popover — click to open (not the old hover-reveal panel),
// showing the signed-in name + email and a red "Sign out" button. Clicking that opens
// Hero UI's AlertDialog to actually confirm before signing out, rather than doing it on
// the first click — a stray click used to be one tap away from an immediate sign-out.
export function UserMenu({
  fullName,
  email,
  expanded,
}: {
  fullName: string;
  email: string | null;
  expanded: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleSignOut() {
    const supabase = getBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="shrink-0 border-t-2 border-border p-2">
      <Popover.Root>
        <Popover.Trigger>
          <Button variant="ghost" fullWidth className="justify-start gap-3 overflow-hidden !px-2">
            <UserIcon className="h-6 w-6 shrink-0 text-muted" />
            <span
              className={
                "min-w-0 flex-1 truncate whitespace-nowrap text-left text-sm font-normal text-muted transition-[max-width,opacity] duration-150 " +
                (expanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0")
              }
              title={fullName}
            >
              {fullName}
            </span>
          </Button>
        </Popover.Trigger>
        <Popover.Content placement="top">
          <Popover.Dialog className="flex w-64 flex-col gap-3 p-3">
            <div className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-medium text-foreground" title={fullName}>
                {fullName}
              </span>
              <span className="truncate text-xs text-muted" title={email ?? undefined}>
                {email ?? "No email on file"}
              </span>
            </div>
            <Button variant="danger" size="sm" fullWidth onPress={() => setConfirmOpen(true)}>
              <SignOutIcon className="h-4 w-4" />
              Sign out
            </Button>
          </Popover.Dialog>
        </Popover.Content>
      </Popover.Root>

      <AlertDialog.Root isOpen={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Header>
                <AlertDialog.Heading>Sign out of Atlas?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>You&rsquo;ll need to sign in again to get back in.</AlertDialog.Body>
              <AlertDialog.Footer>
                <AlertDialog.CloseTrigger>Cancel</AlertDialog.CloseTrigger>
                <Button variant="danger" onPress={handleSignOut}>
                  Sign out
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog.Root>
    </div>
  );
}
