"use client";

import { useEffect, useState } from "react";

/**
 * Defers rendering until after the first client paint.
 *
 * Auth state only exists in the browser (Supabase reads the session from
 * localStorage), so any subtree that branches on it renders differently on the
 * server than on the client's first pass — which React reports as a hydration
 * mismatch. Gating those subtrees behind a mount flag makes the first client
 * render match the server output exactly.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
