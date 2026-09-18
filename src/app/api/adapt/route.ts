import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { CostEntry } from "@/lib/anthropic";
import { info, warn, error, success } from "@/lib/notifications";
import { PipelineNotification } from "@/types";
import { getAuthUser } from "@/lib/auth-api";
import { adaptAllChannels, validateChannelOutput, cleanForPlatform } from "@/lib/channel-adaptation";
import { sendReviewNotification } from "@/lib/discord";

export const maxDuration = 60;

/**
 * POST /api/adapt
 * Adapts selected article for LinkedIn, X, newsletter.
 * Hardened: no new claims, no fabricated links, validates output against rules.
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

    const { data: request } = await sb.from("content_requests").select("*").eq("id", request_id).single();
    const { data: draft } = await sb.from("content_drafts").select("*").eq("id", draft_id).single();
    if (!request || !draft) {
      return NextResponse.json({ success: false, error: "Request or draft not found." }, { status: 404 });
    }

    const notifications: PipelineNotification[] = request.notifications || [];
    const costs: CostEntry[] = [];

    await sb.from("content_drafts").update({ status: "selected" }).eq("id", draft_id);
    await sb.from("content_drafts").update({ status: "draft" }).eq("request_id", request_id).neq("id", draft_id).eq("status", "selected");

    notifications.push(info("adaptation", "Adapting your article for LinkedIn, X, and newsletter…"));
    await sb.from("content_requests").update({ status: "adapting", notifications }).eq("id", request_id);

    const { result: adapted, cost: adaptCost } = await adaptAllChannels({
      topic: request.topic,
      audience: request.audience,
      tone: request.tone,
      articleMarkdown: draft.article_markdown,
    });
    costs.push(adaptCost);

    // Strip any markdown the model still emitted, so the stored text is
    // paste-ready for the platform.
    const channels = [
      { channel: "linkedin" as const, content: cleanForPlatform(adapted.linkedin?.content || ""), subject_line: null },
      { channel: "x" as const, content: cleanForPlatform(adapted.x?.content || ""), subject_line: null },
      {
        channel: "newsletter" as const,
        content: cleanForPlatform(adapted.newsletter?.content || ""),
        subject_line: adapted.newsletter?.subject_line ? cleanForPlatform(adapted.newsletter.subject_line) : null,
      },
    ];

    // ── Validate channel outputs against formatting rules ──
    // Checked against the cleaned text, since that's what gets published.
    const validationIssues: string[] = [
      ...validateChannelOutput("x", channels[1].content, adapted.x?.format),
      ...validateChannelOutput("linkedin", channels[0].content),
      ...validateChannelOutput("newsletter", channels[2].content),
    ];

    if (validationIssues.length > 0) {
      notifications.push(warn("adaptation",
        "Some channel outputs may need adjustment.",
        validationIssues.join(" · ")
      ));
    }

    let storedCount = 0;
    for (const ch of channels) {
      if (!ch.content) {
        notifications.push(warn("adaptation", `${ch.channel} adaptation was empty — skipped.`));
        continue;
      }

      const { error: upsertErr } = await sb.from("publishing_queue").upsert({
        request_id, draft_id,
        channel: ch.channel,
        formatted_content: ch.content,
        subject_line: ch.subject_line,
        preview_data: {},
        status: "pending_review",
      }, { onConflict: "draft_id,channel" });

      if (!upsertErr) storedCount++;
    }

    if (storedCount === 0) {
      notifications.push(error("adaptation", "No channel versions could be saved."));
      await sb.from("content_requests").update({ status: "failed", notifications }).eq("id", request_id);
      return NextResponse.json({ success: false, error: "No adaptations saved." }, { status: 500 });
    }

    const totalCost = costs.reduce((sum, c) => sum + c.cost_usd, 0);
    notifications.push(success("adaptation",
      `${storedCount} channel format${storedCount === 1 ? "" : "s"} ready for review. Cost: $${totalCost.toFixed(4)}`
    ));
    await sb.from("content_requests").update({ status: "review", notifications }).eq("id", request_id);

    // All channels are now pending_review — tell approvers. Best-effort.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || req.nextUrl.origin;
    await sendReviewNotification({
      topic: request.topic,
      submittedBy: authUser.display_name,
      requestUrl: `${appUrl}/request/${request_id}`,
      detail: `${storedCount} channel format${storedCount === 1 ? "" : "s"} awaiting review.`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
