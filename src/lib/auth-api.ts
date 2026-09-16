import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { UserRole } from "./auth-context";

export interface AuthUser {
  user_id: string;
  email: string;
  role: UserRole | string;
  display_name: string;
}

/**
 * Resolves the authenticated user from a Bearer token in the Authorization
 * header (the app's client sends this via getAuthHeaders()), falling back to
 * a "sb-access-token" cookie if present. Returns null if there is no valid
 * session — callers should reject the request (401) in that case.
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : req.cookies.get("sb-access-token")?.value;

  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const client = createClient(supabaseUrl, anonKey);

  try {
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);
    if (error || !user) return null;

    const { data: profile } = await client
      .from("user_profiles")
      .select("role, display_name")
      .eq("id", user.id)
      .single();

    return {
      user_id: user.id,
      email: user.email || "",
      role: profile?.role || "creator",
      display_name: profile?.display_name || user.email || "Unknown user",
    };
  } catch {
    return null;
  }
}
