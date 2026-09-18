import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth-api";
import { info } from "@/lib/notifications";

export const maxDuration = 10;

/**
 * POST /api/requests
 * Creates the request row and nothing else, so the client can navigate to the
 * detail page immediately. Research is kicked off separately against this id.
 */
export async function POST(req: NextRequest) {
  const sb = getServiceSupabase();

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const { topic, audience, source_url, tone, primary_keyword, additional_context } = await req.json();

    if (!topic?.trim() && !source_url?.trim()) {
      return NextResponse.json({ success: false, error: "Provide a topic or a source URL." }, { status: 400 });
    }

    // Placeholders mirror /api/research — topic/audience are NOT NULL, and the
    // derivation step overwrites them for a URL-only request.
    const { data: row, error: insertErr } = await sb
      .from("content_requests")
      .insert({
        topic: topic?.trim() || `Deriving topic from ${source_url.trim()}`,
        audience: audience?.trim() || "Deriving audience from source…",
        source_url: source_url || null,
        tone: tone || "professional",
        primary_keyword: primary_keyword || null,
        additional_context: additional_context || null,
        status: "researching",
        notifications: [info("intake", "Content request received.")],
      })
      .select("id")
      .single();

    if (insertErr || !row) {
      return NextResponse.json({ success: false, error: `Failed to create request: ${insertErr?.message}` }, { status: 500 });
    }

    // Best-effort — works even before the auth migration's creator_id column.
    await sb.from("content_requests").update({ creator_id: authUser.user_id }).eq("id", row.id);

    return NextResponse.json({ success: true, data: { request_id: row.id } });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
