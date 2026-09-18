"use client";

import { useAuth } from "@/lib/auth-context";

export function NavLinks() {
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  return (
    <div className="hidden sm:flex items-center gap-1 ml-4">
      <a href="/" className="text-sm text-white/70 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors">
        Dashboard
      </a>
      <a href="/queue" className="text-sm text-white/70 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors">
        Publishing Queue
      </a>
    </div>
  );
}
