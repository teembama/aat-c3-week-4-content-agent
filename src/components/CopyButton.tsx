"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { cleanForPlatform } from "@/lib/clean-text";

/**
 * Copies channel content to the clipboard and confirms inline for 2 seconds.
 */
export function CopyButton({
  text,
  label,
  disabled = false,
  disabledTitle,
}: {
  text: string;
  label: string;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  async function handleCopy() {
    try {
      // Cleaned at copy time too, so content adapted before markdown stripping
      // was introduced still pastes cleanly.
      await navigator.clipboard.writeText(cleanForPlatform(text));
      toast.success(`${label} copied!`);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  const isDisabled = disabled || !text;

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={isDisabled}
      title={isDisabled ? disabledTitle : undefined}
      className={`px-2 py-1 text-[10px] font-medium text-[#5a5550] border border-[#d1cbc6] rounded-md transition-colors flex-shrink-0 ${
        isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-[#e8e3df]"
      }`}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
