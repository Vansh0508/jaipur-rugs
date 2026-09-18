import { NextResponse } from "next/server";
import { getNextNumberForPrefix } from "@/lib/design-series";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get("prefix") || "";

    if (!prefix) {
      return NextResponse.json(
        { success: false, error: "Missing required query parameter 'prefix'" },
        { status: 400 }
      );
    }

    const result = getNextNumberForPrefix(prefix);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
