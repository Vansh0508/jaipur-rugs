import { NextResponse } from "next/server";
import {
  loadDesignSeries,
  loadYarnLookup,
  matchesMaterialOrYarnQuery,
} from "@/lib/design-series";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const construction = searchParams.get("construction") || "";
    const quality = searchParams.get("quality") || "";
    const query = searchParams.get("query") || "";

    const allRecords = loadDesignSeries();
    const yarnLookup = loadYarnLookup();

    let filtered = allRecords;

    if (construction) {
      filtered = filtered.filter(
        (r) => r.construction.toLowerCase() === construction.toLowerCase()
      );
    }

    if (quality) {
      filtered = filtered.filter(
        (r) => r.quality.toLowerCase() === quality.toLowerCase()
      );
    }

    if (query) {
      filtered = filtered.filter((r) =>
        matchesMaterialOrYarnQuery(r, query, yarnLookup)
      );
    }

    // Build unique constructions and qualities map
    const constructionsSet = new Set<string>();
    const qualitiesByConstruction: Record<string, string[]> = {};

    for (const r of allRecords) {
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

    // Sort qualities
    for (const k in qualitiesByConstruction) {
      qualitiesByConstruction[k].sort();
    }

    return NextResponse.json({
      success: true,
      count: filtered.length,
      records: filtered,
      constructions: Array.from(constructionsSet).sort(),
      qualitiesByConstruction,
      yarnLookup,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
