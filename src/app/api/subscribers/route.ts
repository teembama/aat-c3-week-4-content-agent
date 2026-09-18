import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth-api";

export const maxDuration = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** GET /api/subscribers — active subscribers. Any signed-in user. */
export async function GET(req: NextRequest) {
  const sb = getServiceSupabase();

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await sb
    .from("newsletter_subscribers")
    .select("id, email, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data || [] });
}

/** POST /api/subscribers — add a subscriber. Approvers only. */
export async function POST(req: NextRequest) {
  const sb = getServiceSupabase();

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }
  if (authUser.role !== "approver") {
    return NextResponse.json({ success: false, error: "Only approvers can manage subscribers." }, { status: 403 });
  }

  const { email } = await req.json();
  const normalized = (email || "").trim().toLowerCase();

  if (!normalized || !EMAIL_RE.test(normalized)) {
    return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
  }

  const { data: existing } = await sb
    .from("newsletter_subscribers")
    .select("id, active")
    .eq("email", normalized)
    .maybeSingle();

  if (existing) {
    if (existing.active) {
      return NextResponse.json({ success: false, error: "That email is already subscribed." }, { status: 409 });
    }
    // Previously removed — reactivate rather than fail on the unique constraint.
    const { error: reactivateErr } = await sb
      .from("newsletter_subscribers")
      .update({ active: true, added_by: authUser.user_id })
      .eq("id", existing.id);
    if (reactivateErr) {
      return NextResponse.json({ success: false, error: reactivateErr.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: { id: existing.id, email: normalized, reactivated: true } });
  }

  const { data, error } = await sb
    .from("newsletter_subscribers")
    .insert({ email: normalized, added_by: authUser.user_id, active: true })
    .select("id, email, created_at")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

/** DELETE /api/subscribers — soft-delete a subscriber. Approvers only. */
export async function DELETE(req: NextRequest) {
  const sb = getServiceSupabase();

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }
  if (authUser.role !== "approver") {
    return NextResponse.json({ success: false, error: "Only approvers can manage subscribers." }, { status: 403 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing subscriber id." }, { status: 400 });
  }

  const { error } = await sb.from("newsletter_subscribers").update({ active: false }).eq("id", id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { id } });
}
