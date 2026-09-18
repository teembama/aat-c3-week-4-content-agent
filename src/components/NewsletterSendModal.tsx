"use client";

import { useEffect, useMemo, useState } from "react";
import { getAuthHeaders } from "@/lib/auth-context";

const NAME_PLACEHOLDER = "[Your Name]";

/**
 * Best-effort read of the name already used in the sign-off: the last
 * non-empty line, accepted only when the line before it ends with a comma
 * ("Best regards," / "To your team's wellbeing,"). Anything else returns
 * empty rather than guessing at a sentence.
 */
function extractSignOffName(content: string): string {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return "";

  const last = lines[lines.length - 1];
  const previous = lines[lines.length - 2];

  if (last === NAME_PLACEHOLDER) return "";
  if (!previous.endsWith(",")) return "";
  if (last.length > 60) return "";

  return last;
}

/**
 * Final review step before a newsletter goes out. The body is read-only —
 * it has already passed claim verification and evaluation, and free editing
 * would bypass both. Only the sign-off name can be set here.
 */
export function NewsletterSendModal({
  open,
  initialContent,
  busy = false,
  onSend,
  onCancel,
}: {
  open: boolean;
  initialContent: string;
  busy?: boolean;
  onSend: (content: string) => void;
  onCancel: () => void;
}) {
  const [senderName, setSenderName] = useState("");
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  const hasPlaceholder = initialContent.includes(NAME_PLACEHOLDER);
  const existingName = useMemo(() => extractSignOffName(initialContent), [initialContent]);

  // Seed the field each time the dialog opens: blank when the content still
  // carries the placeholder, otherwise whatever name is already signed off.
  useEffect(() => {
    if (open) setSenderName(hasPlaceholder ? "" : existingName);
  }, [open, hasPlaceholder, existingName]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/subscribers", { headers: { ...(await getAuthHeaders()) } });
        const json = await res.json();
        if (!cancelled && json.success) setSubscriberCount((json.data || []).length);
      } catch {
        if (!cancelled) setSubscriberCount(null);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  const trimmedName = senderName.trim();
  const nameMissing = hasPlaceholder && !trimmedName;

  const sendLabel =
    subscriberCount === null
      ? "Send Newsletter"
      : `Send to ${subscriberCount} subscriber${subscriberCount === 1 ? "" : "s"}`;

  function buildContent(): string {
    if (hasPlaceholder) {
      return initialContent.split(NAME_PLACEHOLDER).join(trimmedName);
    }
    // No placeholder — only swap the sign-off name if it was actually changed.
    if (existingName && trimmedName && trimmedName !== existingName) {
      const at = initialContent.lastIndexOf(existingName);
      if (at !== -1) {
        return initialContent.slice(0, at) + trimmedName + initialContent.slice(at + existingName.length);
      }
    }
    return initialContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onCancel} />
      <div className="relative bg-white rounded-xl border border-[#d1cbc6] shadow-lg w-full max-w-2xl p-5 max-h-[90vh] flex flex-col">
        <h3 className="text-sm font-semibold text-[#1a1a1a] mb-1">Review &amp; Send Newsletter</h3>
        <p className="text-xs text-[#5a5550] mb-3">
          Review the content below, then enter the name to use in the sign-off.
        </p>

        <div className="text-xs text-[#5a5550] whitespace-pre-wrap overflow-y-auto border border-[#e8e3df] rounded-lg p-3 bg-[#faf9f8] flex-1 min-h-[200px] max-h-[45vh]">
          {initialContent}
        </div>

        <div className="mt-4">
          <label htmlFor="sender-name" className="block text-sm font-medium text-[#1a1a1a] mb-1">
            Sender name <span className="text-[#8a847f] font-normal">(appears in the sign-off)</span>
          </label>
          <input
            id="sender-name"
            type="text"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            disabled={busy}
            placeholder="e.g. Therese Mbama"
            className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f1823] focus:border-transparent disabled:opacity-60 ${
              nameMissing ? "border-amber-400 ring-1 ring-amber-200" : "border-[#d1cbc6]"
            }`}
          />
          {nameMissing && (
            <p className="text-xs text-amber-700 mt-1.5">
              Please enter your name for the sign-off before sending
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-[#5a5550] border border-[#d1cbc6] rounded-lg hover:bg-[#e8e3df] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSend(buildContent())}
            disabled={busy || nameMissing || subscriberCount === 0}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-[#2d7a4f] hover:bg-[#246b42] disabled:opacity-50 transition-colors"
          >
            {busy ? "Sending…" : sendLabel}
          </button>
        </div>

        {subscriberCount === 0 && (
          <p className="text-xs text-[#c43c3c] mt-2 text-right">
            No subscribers yet — add some on the Subscribers page first.
          </p>
        )}
      </div>
    </div>
  );
}
