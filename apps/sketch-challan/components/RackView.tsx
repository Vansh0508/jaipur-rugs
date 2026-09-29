"use client";

import { useState } from "react";
import { Button } from "@jaipur-rugs/ui-kit";
import { MapsTab } from "@/components/MapsTab";
import type { MapsState } from "@/lib/maps/types";

// The rack management login sees only where each map is (user, 2026-09-29): no challans, no other tabs.
export function RackView({ initialMaps, name }: { initialMaps: MapsState; name: string }) {
  const [maps, setMaps] = useState(initialMaps);

  async function signOut() {
    await fetch("/api/demo-logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-surface p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Map Library</h1>
          <p className="text-sm text-muted">{name} · Rack management</p>
        </div>
        <Button size="sm" variant="secondary" onPress={() => void signOut()}>Sign out</Button>
      </header>
      <MapsTab state={maps} setState={setMaps} canRefresh={false} />
    </main>
  );
}
