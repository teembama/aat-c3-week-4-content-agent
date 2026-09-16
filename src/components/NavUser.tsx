"use client";

import { useAuth } from "@/lib/auth-context";

/**
 * Shows the signed-in user's name, role badge, and a sign-out button in the
 * nav bar. Renders nothing while loading or when signed out.
 */
export function NavUser() {
  const { user, profile, loading, signOut } = useAuth();

  if (loading || !user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-white/90 hidden sm:inline">
        {profile?.display_name || user.email}
      </span>
      <span className="text-[10px] font-medium bg-white/15 text-white/80 px-2 py-0.5 rounded-full">
        {profile?.role === "approver" ? "Approver" : "Creator"}
      </span>
      <button
        onClick={signOut}
        className="text-xs text-white/70 hover:text-white px-3 py-1.5 rounded-md border border-white/20 hover:bg-white/10 transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}
