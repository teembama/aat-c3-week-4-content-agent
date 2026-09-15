import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const maxDuration = 10;

/**
 * POST /api/publish
 * State machine: pending_review → approved → published
 * Cannot publish without approval (server-side enforced).
 * Rejected items don't block other channels from publishing.
 */
export async function POST(req: NextRequest) {
  const sb = getServiceSupabase();

  try {
    const { queue_id, action } = await req.json();
    if (!queue_id || !action) {
      return NextResponse.json({ success: false, error: "Missing queue_id or action." }, { status: 400 });
    }
    if (!["approve", "reject", "publish"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
    }

    const { data: item } = await sb.from("publishing_queue").select("*").eq("id", queue_id).single();
    if (!item) return NextResponse.json({ success: false, error: "Queue item not found." }, { status: 404 });

    if (action === "approve") {
      if (item.status !== "pending_review") {
        return NextResponse.json({ success: false, error: `Cannot approve: status is "${item.status}".` }, { status: 400 });
      }
      await sb.from("publishing_queue").update({
        status: "approved",
        approved_by: "content_manager",
        approved_at: new Date().toISOString(),
      }).eq("id", queue_id);
    }

    if (action === "reject") {
      if (item.status !== "pending_review") {
        return NextResponse.json({ success: false, error: `Cannot reject: status is "${item.status}".` }, { status: 400 });
      }
      await sb.from("publishing_queue").update({ status: "rejected" }).eq("id", queue_id);
    }

    if (action === "publish") {
      if (item.status !== "approved") {
        return NextResponse.json({
          success: false,
          error: "Content must be approved before publishing. Current status: " + item.status,
        }, { status: 400 });
      }
      await sb.from("publishing_queue").update({
        status: "published",
        published_at: new Date().toISOString(),
      }).eq("id", queue_id);
    }

    // Update request status — rejected items don't block others
    const { data: allItems } = await sb.from("publishing_queue").select("status").eq("request_id", item.request_id);
    const resolved = (allItems || []).filter((i: any) => i.status !== "rejected");

    if (resolved.length > 0 && resolved.every((i: any) => i.status === "published")) {
      await sb.from("content_requests").update({ status: "published" }).eq("id", item.request_id);
    } else if (resolved.length > 0 && resolved.every((i: any) => ["approved", "published"].includes(i.status))) {
      await sb.from("content_requests").update({ status: "approved" }).eq("id", item.request_id);
    }

    return NextResponse.json({ success: true, data: { action, queue_id } });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
