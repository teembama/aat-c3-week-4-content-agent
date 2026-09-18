export type DiscordAction = "approved" | "published" | "rejected" | "unpublished" | "unapproved";

const COLOR = {
  blue: 0x3b6fa0,
  green: 0x2d7a4f,
  red: 0xc43c3c,
  orange: 0xb5760a,
} as const;

const ACTION_COLOR: Record<DiscordAction, number> = {
  approved: COLOR.green,
  published: COLOR.green,
  rejected: COLOR.red,
  unpublished: COLOR.orange,
  unapproved: COLOR.orange,
};

const ACTION_TITLE: Record<DiscordAction, string> = {
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
  unpublished: "Unpublished",
  unapproved: "Approval Revoked",
};

/**
 * Posts an embed to a Discord webhook. Never throws — a missing or unreachable
 * webhook must not break the pipeline action that triggered it.
 */
async function post(
  webhookUrl: string | undefined,
  embed: Record<string, unknown>
): Promise<void> {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [{ ...embed, timestamp: new Date().toISOString() }] }),
    });
  } catch {
    // Non-critical — a Discord outage must not fail the underlying action.
  }
}

/**
 * Review channel: content has entered pending_review and needs an approver.
 */
export async function sendReviewNotification(params: {
  topic: string;
  channel?: string;
  submittedBy: string;
  requestUrl: string;
  detail?: string;
}): Promise<void> {
  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    { name: "Topic", value: params.topic || "(untitled)", inline: false },
  ];
  if (params.channel) fields.push({ name: "Channel", value: params.channel, inline: true });
  fields.push({ name: "Submitted by", value: params.submittedBy || "Unknown", inline: true });
  if (params.detail) fields.push({ name: "Details", value: params.detail, inline: false });
  fields.push({ name: "Link", value: params.requestUrl, inline: false });

  await post(process.env.DISCORD_WEBHOOK_REVIEW, {
    title: "New content ready for review",
    color: COLOR.blue,
    fields,
  });
}

/**
 * Approvals channel: an approver made a decision the team should see.
 */
export async function sendApprovalNotification(params: {
  action: DiscordAction;
  channel: string;
  topic: string;
  performedBy: string;
  requestUrl: string;
}): Promise<void> {
  await post(process.env.DISCORD_WEBHOOK_APPROVALS, {
    title: `${ACTION_TITLE[params.action]} — ${params.channel}`,
    color: ACTION_COLOR[params.action] ?? 0x8a847f,
    fields: [
      { name: "Topic", value: params.topic || "(untitled)", inline: false },
      { name: "Channel", value: params.channel, inline: true },
      { name: "Performed by", value: params.performedBy || "Unknown", inline: true },
      { name: "Link", value: params.requestUrl, inline: false },
    ],
  });
}
