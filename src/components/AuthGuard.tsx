"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Wraps page content and redirects to /login when there is no authenticated
 * session. Renders nothing until the auth state is known, to avoid a flash
 * of protected content.
 *
 * The `mounted` flag keeps the first client render identical to the
 * server-rendered HTML — see ClientOnly for why.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !loading && !user) {
      router.replace("/login");
    }
  }, [mounted, loading, user, router]);

  if (!mounted || loading) {
    return <div className="text-center py-16 text-[#8a847f]">Loading…</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
