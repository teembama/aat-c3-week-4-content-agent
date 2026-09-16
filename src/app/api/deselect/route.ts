import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth-api";

export const maxDuration = 10;

/**
 * POST /api/deselect
 * Reverses a "Select & Adapt" action: removes the channel adaptations for a
 * request and returns the draft to "draft" status so a different article can
 * be picked. Blocked once any channel has already been approved or published
 * — those must be unapproved/unpublished first.
 */
export async function POST(req: NextRequest) {
  const sb = getServiceSupabase();

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const { request_id, draft_id } = await req.json();
    if (!request_id || !draft_id) {
      return NextResponse.json({ success: false, error: "Missing request_id or draft_id." }, { status: 400 });
    }

    const { data: queueItems } = await sb.from("publishing_queue").select("status").eq("request_id", request_id);
    const hasApprovedOrPublished = (queueItems || []).some(
      (q: any) => q.status === "approved" || q.status === "published"
    );
    if (hasApprovedOrPublished) {
      return NextResponse.json(
        { success: false, error: "Cannot deselect — some channels are already approved or published. Unpublish or revoke approval first." },
        { status: 400 }
      );
    }

    await sb.from("publishing_queue").delete().eq("request_id", request_id);
    await sb.from("content_drafts").update({ status: "draft" }).eq("id", draft_id);
    await sb.from("content_requests").update({ status: "review" }).eq("id", request_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
