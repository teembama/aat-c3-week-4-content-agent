"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

/**
 * Copies channel content to the clipboard and confirms inline for 2 seconds.
 */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied!`);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!text}
      className="px-2 py-1 text-[10px] font-medium text-[#5a5550] border border-[#d1cbc6] rounded-md hover:bg-[#e8e3df] disabled:opacity-50 transition-colors flex-shrink-0"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
