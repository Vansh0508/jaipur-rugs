"use client";

import { useState } from "react";
import { Button } from "@jaipur-rugs/ui-kit";
import { MapsTab } from "@/components/MapsTab";
import { ChallanTable } from "@/components/ChallanTable";
import { PaperChallan } from "@/components/PaperChallan";
import { challanStage } from "@/lib/domain/assignments";
import type { SketchChallan } from "@/lib/domain/types";
import type { MapsState } from "@/lib/maps/types";

type View = "new" | "approved" | "maps";

// The rack management login (user, 29 Sep meeting): New challan and Approved to look at, and the Maps screen.
// Nothing here changes a challan; the server refuses challan writes for this role (app/api/demo-action).
export function RackView({ initialMaps, challans, name }: { initialMaps: MapsState; challans: SketchChallan[]; name: string }) {
  const [maps, setMaps] = useState(initialMaps);
  const [view, setView] = useState<View>("maps");
  const [openId, setOpenId] = useState<string | null>(null);
  const lists = { new: challans.filter((row) => challanStage(row) === "new"), approved: challans.filter((row) => challanStage(row) === "approved") };
  const open = challans.find((row) => row.id === openId);
  const tabs: [View, string][] = [["new", `New challan (${lists.new.length})`], ["approved", `Approved (${lists.approved.length})`], ["maps", `Maps (${maps.orders.length})`]];

  async function signOut() {
    await fetch("/api/demo-logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-surface p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sketch Challan</h1>
          <p className="text-sm text-muted">{name} · Rack management</p>
        </div>
        <Button size="sm" variant="secondary" onPress={() => void signOut()}>Sign out</Button>
      </header>
      <nav className="flex gap-2 overflow-x-auto">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => { setView(id); setOpenId(null); }}
            className={"shrink-0 rounded-lg px-3 py-2 text-sm " + (view === id ? "bg-accent/10 font-semibold text-accent" : "text-foreground hover:bg-surface-secondary")}
          >
            {label}
          </button>
        ))}
      </nav>
      {view === "maps" ? <MapsTab state={maps} setState={setMaps} canRefresh={false} role="rack" /> : open ? (
        <div className="flex flex-col gap-4">
          <div><Button variant="secondary" onPress={() => setOpenId(null)}>Back</Button></div>
          <PaperChallan row={open} mode="view" />
        </div>
      ) : <ChallanTable key={view} rows={lists[view]} onPreview={setOpenId} />}
    </main>
  );
}
