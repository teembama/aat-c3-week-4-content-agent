"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Wraps page content and redirects to /login when there is no authenticated
 * session. Renders nothing until the auth state is known, to avoid a flash
 * of protected content.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return <div className="text-center py-16 text-[#8a847f]">Loading…</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
