export type DiscordAction = "approved" | "published" | "rejected" | "unpublished" | "unapproved";

const ACTION_COLOR: Record<DiscordAction, number> = {
  published: 0x2d7a4f, // green
  unpublished: 0xb5760a, // orange
  approved: 0x3b6fa0, // blue
  rejected: 0xc43c3c, // red
  unapproved: 0xb5760a, // orange
};

const ACTION_TITLE: Record<DiscordAction, string> = {
  published: "Published",
  unpublished: "Unpublished",
  approved: "Approved",
  rejected: "Rejected",
  unapproved: "Approval Revoked",
};

/**
 * Posts an embed-style notification to the team's Discord webhook.
 * Never throws — a missing/unreachable webhook must not break the
 * publish/approve/reject pipeline.
 */
export async function sendDiscordNotification(params: {
  action: DiscordAction;
  channel: string;
  topic: string;
  performedBy: string;
  requestUrl: string;
}): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: `${ACTION_TITLE[params.action]} — ${params.channel}`,
            color: ACTION_COLOR[params.action] ?? 0x8a847f,
            fields: [
              { name: "Topic", value: params.topic || "(untitled)", inline: false },
              { name: "Performed by", value: params.performedBy || "Unknown", inline: true },
              { name: "Link", value: params.requestUrl, inline: false },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch {
    // Non-critical — a Discord outage must not fail the underlying action.
  }
}
