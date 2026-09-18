import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth-api";
import { info } from "@/lib/notifications";
import { PipelineNotification } from "@/types";

export const maxDuration = 10;

/**
 * POST /api/cancel
 * Raises the cancellation flag for a request. A running generation can't have
 * its in-flight Claude call killed, so it checks this flag between steps and
 * stops at the next boundary. Drafts already stored are kept.
 */
export async function POST(req: NextRequest) {
  const sb = getServiceSupabase();

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const { request_id } = await req.json();
    if (!request_id) {
      return NextResponse.json({ success: false, error: "Missing request_id." }, { status: 400 });
    }

    const { data: request } = await sb
      .from("content_requests")
      .select("notifications")
      .eq("id", request_id)
      .single();

    if (!request) {
      return NextResponse.json({ success: false, error: "Request not found." }, { status: 404 });
    }

    const notifications: PipelineNotification[] = request.notifications || [];
    notifications.push(info("generation", "Generation cancelled by user."));

    const { error: updateErr } = await sb
      .from("content_requests")
      .update({ cancelled: true, status: "failed", notifications })
      .eq("id", request_id);

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { request_id } });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
