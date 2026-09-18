import { Resend } from "resend";

let client: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders the stored plain-text newsletter as simple email HTML.
 * Escaping runs first so source text can never inject markup.
 */
export function newsletterToHtml(content: string): string {
  const body = escapeHtml(content)
    .split(/\n\s*\n/)
    .filter((block) => block.trim())
    .map((block) => {
      const withBold = block
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br />");
      return `<p style="margin:0 0 16px;line-height:1.6">${withBold}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f5f3f1;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:32px;border-radius:12px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#1a1a1a;">
${body}
</div></body></html>`;
}

/**
 * Sends the newsletter to each subscriber as a separate message, so no
 * recipient sees another's address. Never throws — a send failure must not
 * break the publish flow that called it.
 */
export async function sendNewsletter(params: {
  to: string[];
  subject: string;
  content: string;
  fromName?: string;
}): Promise<{ success: boolean; sent: number; failed: string[]; error?: string }> {
  const recipients = params.to
    .filter((e) => e && e.trim())
    .filter((e, i, all) => all.indexOf(e) === i);
  if (recipients.length === 0) {
    return { success: false, sent: 0, failed: [], error: "No recipients provided." };
  }

  const resend = getResend();
  if (!resend) {
    return { success: false, sent: 0, failed: recipients, error: "RESEND_API_KEY is not set." };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    return { success: false, sent: 0, failed: recipients, error: "RESEND_FROM_EMAIL is not set." };
  }
  const from = params.fromName ? `${params.fromName} <${fromEmail}>` : fromEmail;

  const html = newsletterToHtml(params.content);
  const subject = params.subject?.trim() || "Newsletter";
  const failed: string[] = [];
  let sent = 0;
  let firstError: string | undefined;

  for (const recipient of recipients) {
    try {
      const { error } = await resend.emails.send({
        from,
        to: [recipient],
        subject,
        html,
        text: params.content,
      });
      if (error) {
        failed.push(recipient);
        firstError = firstError || error.message;
      } else {
        sent++;
      }
    } catch (err) {
      failed.push(recipient);
      firstError = firstError || (err instanceof Error ? err.message : "Unknown send error");
    }
  }

  return {
    success: sent > 0,
    sent,
    failed,
    error: sent === 0 ? firstError || "All sends failed." : undefined,
  };
}
