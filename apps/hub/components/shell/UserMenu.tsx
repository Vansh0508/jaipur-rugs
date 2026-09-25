"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popover, AlertDialog, Button } from "@jaipur-rugs/ui-kit";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { SignOutIcon, UserIcon } from "./icons";

// Matches apps/atlas/components/shell/UserMenu.tsx's pattern — click-to-open Hero UI
// Popover showing the signed-in name, then Hero UI AlertDialog to actually confirm sign
// out, rather than a plain always-visible button. Needed here for the same reason it was
// needed there: once the sidebar can collapse to icon-only width (SidebarShell.tsx),
// there's no room left for an inline name + button, so the trigger has to be icon-only
// with the details behind a click.
export function UserMenu({ fullName, expanded }: { fullName: string; expanded: boolean }) {
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
                <AlertDialog.Heading>Sign out of Hub?</AlertDialog.Heading>
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
