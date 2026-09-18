import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth-api";
import { adaptSingleChannel, validateChannelOutput, AdaptChannel } from "@/lib/channel-adaptation";
import { sendReviewNotification } from "@/lib/discord";
import { warn, success } from "@/lib/notifications";
import { PipelineNotification } from "@/types";

export const maxDuration = 60;

const MAX_REGENERATIONS = 2;

const CHANNELS: AdaptChannel[] = ["linkedin", "x", "newsletter"];

/**
 * POST /api/regenerate-channel
 * Re-adapts a single rejected channel output and puts it back into
 * pending_review. Capped at MAX_REGENERATIONS attempts per channel — past
 * that the team handles it manually.
 */
export async function POST(req: NextRequest) {
  const sb = getServiceSupabase();

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const { request_id, draft_id, channel } = await req.json();
    if (!request_id || !draft_id || !channel) {
      return NextResponse.json({ success: false, error: "Missing request_id, draft_id, or channel." }, { status: 400 });
    }
    if (!CHANNELS.includes(channel)) {
      return NextResponse.json({ success: false, error: "Invalid channel." }, { status: 400 });
    }

    const { data: item } = await sb
      .from("publishing_queue")
      .select("*")
      .eq("request_id", request_id)
      .eq("draft_id", draft_id)
      .eq("channel", channel)
      .single();

    if (!item) {
      return NextResponse.json({ success: false, error: "Queue item not found." }, { status: 404 });
    }
    if (item.status !== "rejected") {
      return NextResponse.json(
        { success: false, error: `Only rejected content can be regenerated. Current status: "${item.status}".` },
        { status: 400 }
      );
    }

    const usedSoFar = item.regeneration_count ?? 0;
    if (usedSoFar >= MAX_REGENERATIONS) {
      return NextResponse.json(
        { success: false, error: "Maximum regenerations reached for this channel." },
        { status: 400 }
      );
    }

    const { data: request } = await sb.from("content_requests").select("*").eq("id", request_id).single();
    const { data: draft } = await sb.from("content_drafts").select("*").eq("id", draft_id).single();
    if (!request || !draft) {
      return NextResponse.json({ success: false, error: "Request or draft not found." }, { status: 404 });
    }

    const { result: adapted, cost } = await adaptSingleChannel(channel, {
      topic: request.topic,
      audience: request.audience,
      tone: request.tone,
      articleMarkdown: draft.article_markdown,
    });

    if (!adapted?.content) {
      return NextResponse.json({ success: false, error: "Regeneration returned empty content." }, { status: 500 });
    }

    const { error: updateErr } = await sb
      .from("publishing_queue")
      .update({
        formatted_content: adapted.content,
        subject_line: channel === "newsletter" ? adapted.subject_line || item.subject_line : item.subject_line,
        status: "pending_review",
        regeneration_count: usedSoFar + 1,
      })
      .eq("id", item.id);

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    // The request is back in review now that a channel is pending again.
    await sb.from("content_requests").update({ status: "review" }).eq("id", request_id);

    // Record it on the request's activity trail.
    const notifications: PipelineNotification[] = request.notifications || [];
    const issues = validateChannelOutput(channel, adapted.content, adapted.format);
    notifications.push(
      success(
        "adaptation",
        `${channel} regenerated (attempt ${usedSoFar + 1} of ${MAX_REGENERATIONS}) and sent back for review. Cost: $${cost.cost_usd.toFixed(4)}`
      )
    );
    if (issues.length > 0) {
      notifications.push(warn("adaptation", `Regenerated ${channel} may need adjustment.`, issues.join(" · ")));
    }
    await sb.from("content_requests").update({ notifications }).eq("id", request_id);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || req.nextUrl.origin;
    await sendReviewNotification({
      topic: request.topic,
      channel,
      submittedBy: authUser.display_name,
      requestUrl: `${appUrl}/request/${request_id}`,
      detail: `Regenerated after rejection (attempt ${usedSoFar + 1} of ${MAX_REGENERATIONS}).`,
    });

    return NextResponse.json({
      success: true,
      data: { channel, regeneration_count: usedSoFar + 1, remaining: MAX_REGENERATIONS - (usedSoFar + 1) },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
