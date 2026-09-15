import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * POST /api/evaluate
 * Evaluation is handled internally by /api/generate as part of the
 * generation pipeline. This endpoint exists for potential standalone
 * re-evaluation in the future.
 */
export async function POST(req: NextRequest) {
  return NextResponse.json(
    { success: false, error: "Evaluation runs automatically during generation. Use /api/generate instead." },
    { status: 400 }
  );
}
