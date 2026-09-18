import React from "react";
import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { DesignSeriesView } from "@/components/design-series/DesignSeriesView";
import {
  loadDesignSeries,
  loadYarnLookup,
} from "@/lib/design-series";

export const metadata: Metadata = {
  title: "Design Series & Code Generator | BOM Checker",
  description:
    "Explore registered design series recipes and generate the next available code for carpet production.",
};

export default async function DesignSeriesPage() {
  const series = loadDesignSeries();
  const yarnLookup = loadYarnLookup();

  // Compute constructions and qualities map
  const constructionsSet = new Set<string>();
  const qualitiesByConstruction: Record<string, string[]> = {};

  for (const r of series) {
    const c = r.construction;
    const q = r.quality;
    constructionsSet.add(c);
    if (!qualitiesByConstruction[c]) {
      qualitiesByConstruction[c] = [];
    }
    if (q && !qualitiesByConstruction[c].includes(q)) {
      qualitiesByConstruction[c].push(q);
    }
  }

  for (const k in qualitiesByConstruction) {
    qualitiesByConstruction[k].sort();
  }

  const constructions = Array.from(constructionsSet).sort();

  return (
    <AppShell
      currentTab="design-series"
      userEmail="auditor@jaipurrugs.com"
      userName="D&D Auditor"
      userRole="Design Auditor"
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <DesignSeriesView
          initialSeries={series}
          yarnLookup={yarnLookup}
          constructions={constructions}
          qualitiesByConstruction={qualitiesByConstruction}
        />
      </div>
    </AppShell>
  );
}
