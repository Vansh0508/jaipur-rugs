import { NextRequest, NextResponse } from "next/server";
import { evaluateRugsBatch, RugEvaluationInput } from "@/lib/bom-evaluator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items: RugEvaluationInput[] = body.items || [];
    const bypassCache = !!body.bypassCache;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: true, evaluations: {} });
    }

    // Limit batch size to 100 items for safety
    const safeItems = items.slice(0, 100);
    const evaluations = await evaluateRugsBatch(safeItems, { bypassCache });

    return NextResponse.json(
      {
        success: true,
        count: Object.keys(evaluations).length,
        evaluations,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error: any) {
    console.error("API /api/bom/evaluate-rugs error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to evaluate rug BOM validity and weight accuracy",
      },
      { status: 500 }
    );
  }
}
