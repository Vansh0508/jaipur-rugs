import { NextResponse } from "next/server";
import { loadBenchmarks } from "@/lib/supabase";

export async function GET() {
  try {
    const benchmarksMap = await loadBenchmarks();
    const benchmarks = Array.from(benchmarksMap.values());
    return NextResponse.json({
      success: true,
      count: benchmarks.length,
      benchmarks,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
