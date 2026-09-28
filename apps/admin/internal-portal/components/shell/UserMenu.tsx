"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popover, AlertDialog, Button } from "@jaipur-rugs/ui-kit";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { SignOutIcon, UserIcon } from "./icons";

// Same pattern as apps/hub/components/shell/UserMenu.tsx and apps/atlas's: icon trigger →
// Hero UI Popover with the signed-in name → Hero UI AlertDialog to confirm sign out.
// Needed because the sidebar can collapse to icon-only width (SidebarShell.tsx), leaving
// no room for an inline name + button.
export function UserMenu({ fullName, email, expanded }: { fullName: string; email: string; expanded: boolean }) {
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
              <span className="truncate text-xs text-muted" title={email}>
                {email}
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
              {({ close }) => (
                <>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Header>
                    <AlertDialog.Heading>Sign out of Internal Portal?</AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body>You&rsquo;ll need to sign in again to get back in.</AlertDialog.Body>
                  <AlertDialog.Footer>
                    {/* A plain Button + the render-prop `close()`, not AlertDialog.CloseTrigger:
                        CloseTrigger renders as the dialog's corner "×" icon button, so text put
                        inside it lands squeezed into the top-right corner, not the footer.
                        Same approach as components/cars/CarStatusControls.tsx. */}
                    <Button variant="secondary" onPress={close}>
                      Cancel
                    </Button>
                    <Button variant="danger" onPress={handleSignOut}>
                      Sign out
                    </Button>
                  </AlertDialog.Footer>
                </>
              )}
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog.Root>
    </div>
  );
}
