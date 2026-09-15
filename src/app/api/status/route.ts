import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

/**
 * GET /api/status?id=<request_id>
 * Returns the full state of a content request including sources, drafts, and queue items.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { success: false, error: "Missing request id" },
      { status: 400 }
    );
  }

  const sb = getServiceSupabase();

  const [requestRes, sourcesRes, draftsRes, queueRes] = await Promise.all([
    sb.from("content_requests").select("*").eq("id", id).single(),
    sb.from("research_sources").select("*").eq("request_id", id).order("created_at"),
    sb.from("content_drafts").select("*").eq("request_id", id).order("draft_number"),
    sb.from("publishing_queue").select("*").eq("request_id", id).order("created_at"),
  ]);

  if (requestRes.error || !requestRes.data) {
    return NextResponse.json(
      { success: false, error: "Request not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      request: requestRes.data,
      sources: sourcesRes.data || [],
      drafts: draftsRes.data || [],
      queue: queueRes.data || [],
    },
  });
}
