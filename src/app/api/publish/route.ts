import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth-api";
import { sendApprovalNotification, sendReviewNotification, DiscordAction } from "@/lib/discord";
import { sendNewsletter } from "@/lib/email";
import { success, warn, error } from "@/lib/notifications";
import { PipelineNotification } from "@/types";

// Sending to many subscribers takes longer than a status flip.
export const maxDuration = 60;

/** Appends one notification to a request's activity trail. Best-effort. */
async function appendRequestNotification(sb: any, requestId: string, note: PipelineNotification) {
  const { data: row } = await sb.from("content_requests").select("notifications").eq("id", requestId).single();
  const notifications: PipelineNotification[] = row?.notifications || [];
  notifications.push(note);
  await sb.from("content_requests").update({ notifications }).eq("id", requestId);
}

const VALID_ACTIONS = ["approve", "reject", "publish", "unpublish", "unapprove", "unreject"];

const DISCORD_ACTION_MAP: Record<string, DiscordAction> = {
  approve: "approved",
  reject: "rejected",
  publish: "published",
  unpublish: "unpublished",
  unapprove: "unapproved",
};

/**
 * POST /api/publish
 * State machine: pending_review → approved → published
 *   - "reject" from pending_review → rejected (doesn't block other channels)
 *   - "unapprove" from approved → pending_review (approvers only)
 *   - "unpublish" from published → approved (approvers only, notifies Discord)
 * Cannot publish without approval (server-side enforced).
 * Only users with role "approver" may approve, reject, publish, or reverse
 * a publishing decision — a "creator" role is blocked even for their own
 * requests.
 */
export async function POST(req: NextRequest) {
  const sb = getServiceSupabase();

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const { queue_id, action, edited_content } = await req.json();
    if (!queue_id || !action) {
      return NextResponse.json({ success: false, error: "Missing queue_id or action." }, { status: 400 });
    }
    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
    }

    // Every action in this route (approve/reject/publish/unpublish/unapprove)
    // is an approval decision — only the "approver" role may perform any of
    // them, regardless of whether they created the request.
    if (authUser.role !== "approver") {
      return NextResponse.json(
        { success: false, error: "Only approvers can approve, reject, publish, or reverse publishing decisions." },
        { status: 403 }
      );
    }

    const { data: item } = await sb.from("publishing_queue").select("*").eq("id", queue_id).single();
    if (!item) return NextResponse.json({ success: false, error: "Queue item not found." }, { status: 404 });

    if (action === "approve") {
      if (item.status !== "pending_review") {
        return NextResponse.json({ success: false, error: `Cannot approve: status is "${item.status}".` }, { status: 400 });
      }
      await sb.from("publishing_queue").update({
        status: "approved",
        approved_by: authUser.email,
        approved_at: new Date().toISOString(),
      }).eq("id", queue_id);
      // Best-effort typed column — separate call so approval still works
      // even before the auth migration's approved_by_id column exists.
      await sb.from("publishing_queue").update({ approved_by_id: authUser.user_id }).eq("id", queue_id);
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

      // Publishing the newsletter channel actually sends it. A total send
      // failure leaves the item approved so the user can retry.
      if (item.channel === "newsletter") {
        // The approver may have edited the copy in the send dialog. Persist it
        // first so the stored row matches what actually goes out.
        let contentToSend: string = item.formatted_content || "";
        if (typeof edited_content === "string" && edited_content.trim()) {
          contentToSend = edited_content;
          const { error: editErr } = await sb
            .from("publishing_queue")
            .update({ formatted_content: contentToSend })
            .eq("id", queue_id);
          if (editErr) {
            return NextResponse.json({ success: false, error: editErr.message }, { status: 500 });
          }
        }

        const { data: subscribers } = await sb
          .from("newsletter_subscribers")
          .select("email")
          .eq("active", true);

        const emails = (subscribers || []).map((s: any) => s.email).filter(Boolean);
        if (emails.length === 0) {
          return NextResponse.json({
            success: false,
            error: "No subscribers to send to. Add subscribers in the Subscribers page first.",
          }, { status: 400 });
        }

        const sendResult = await sendNewsletter({
          to: emails,
          subject: item.subject_line || "Newsletter",
          content: contentToSend,
        });

        if (!sendResult.success) {
          await appendRequestNotification(sb, item.request_id,
            error("publishing", `Newsletter send failed: ${sendResult.error || "unknown error"}`));
          return NextResponse.json({
            success: false,
            error: `Newsletter send failed: ${sendResult.error || "unknown error"}`,
          }, { status: 502 });
        }

        await sb.from("publishing_queue").update({
          status: "published",
          published_at: new Date().toISOString(),
          preview_data: {
            ...(item.preview_data || {}),
            sent_count: sendResult.sent,
            subscriber_emails: emails,
            failed_recipients: sendResult.failed,
            sent_at: new Date().toISOString(),
          },
        }).eq("id", queue_id);

        await appendRequestNotification(sb, item.request_id,
          sendResult.failed.length > 0
            ? warn("publishing",
                `Newsletter sent to ${sendResult.sent} subscriber${sendResult.sent === 1 ? "" : "s"}.`,
                `${sendResult.failed.length} address(es) failed: ${sendResult.failed.join(", ")}`)
            : success("publishing", `Newsletter sent to ${sendResult.sent} subscriber${sendResult.sent === 1 ? "" : "s"}.`)
        );
      } else {
        await sb.from("publishing_queue").update({
          status: "published",
          published_at: new Date().toISOString(),
        }).eq("id", queue_id);
      }
    }

    if (action === "unapprove") {
      if (item.status !== "approved") {
        return NextResponse.json({ success: false, error: `Cannot revoke approval: status is "${item.status}".` }, { status: 400 });
      }
      await sb.from("publishing_queue").update({
        status: "pending_review",
        approved_by: null,
        approved_at: null,
      }).eq("id", queue_id);
      await sb.from("publishing_queue").update({ approved_by_id: null }).eq("id", queue_id);
    }

    // Undo a rejection without regenerating the content — the existing
    // formatted_content goes back in front of approvers as-is.
    if (action === "unreject") {
      if (item.status !== "rejected") {
        return NextResponse.json({ success: false, error: `Cannot undo rejection: status is "${item.status}".` }, { status: 400 });
      }
      await sb.from("publishing_queue").update({ status: "pending_review" }).eq("id", queue_id);
    }

    if (action === "unpublish") {
      if (item.status !== "published") {
        return NextResponse.json({ success: false, error: `Cannot unpublish: status is "${item.status}".` }, { status: 400 });
      }
      await sb.from("publishing_queue").update({ status: "approved" }).eq("id", queue_id);
      // Best-effort typed columns — separate call, non-fatal if they don't exist yet.
      await sb.from("publishing_queue").update({
        unpublished_at: new Date().toISOString(),
        unpublished_by_id: authUser.user_id,
      }).eq("id", queue_id);
    }

    // Recompute the parent request's rollup status from current queue state —
    // handles both forward moves (approve/publish) and backward moves
    // (unapprove/unpublish), so a reversal correctly steps the request status
    // back down instead of leaving it stuck on "published"/"approved".
    const { data: allItems } = await sb.from("publishing_queue").select("status").eq("request_id", item.request_id);
    const resolved = (allItems || []).filter((i: any) => i.status !== "rejected");

    if (resolved.length > 0 && resolved.every((i: any) => i.status === "published")) {
      await sb.from("content_requests").update({ status: "published" }).eq("id", item.request_id);
    } else if (resolved.length > 0 && resolved.every((i: any) => ["approved", "published"].includes(i.status))) {
      await sb.from("content_requests").update({ status: "approved" }).eq("id", item.request_id);
    } else if (resolved.length > 0) {
      await sb.from("content_requests").update({ status: "review" }).eq("id", item.request_id);
    }

    // Discord notification — best-effort, never fails the request.
    const discordAction = DISCORD_ACTION_MAP[action];
    if (discordAction || action === "unreject") {
      const { data: parentRequest } = await sb.from("content_requests").select("topic").eq("id", item.request_id).single();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || req.nextUrl.origin;
      const topic = parentRequest?.topic || "Untitled request";
      const requestUrl = `${appUrl}/request/${item.request_id}`;

      if (discordAction) {
        await sendApprovalNotification({
          action: discordAction,
          channel: item.channel,
          topic,
          performedBy: authUser.display_name,
          requestUrl,
        });
      } else {
        // Back in the review queue, so it belongs in the review channel.
        await sendReviewNotification({
          topic,
          channel: item.channel,
          submittedBy: authUser.display_name,
          requestUrl,
          detail: "A previous rejection was undone — this content is pending review again.",
        });
      }
    }

    return NextResponse.json({ success: true, data: { action, queue_id } });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
