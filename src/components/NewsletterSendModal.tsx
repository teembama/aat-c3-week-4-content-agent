"use client";

import { useEffect, useState } from "react";
import { getAuthHeaders } from "@/lib/auth-context";

const NAME_PLACEHOLDER = "[Your Name]";

/**
 * Final review step before a newsletter goes out. The approver edits the copy
 * in place — most often to replace the sign-off placeholder — and the edited
 * text is what gets stored and sent.
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
  const [content, setContent] = useState(initialContent);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  // Reset to the stored copy each time the modal is opened.
  useEffect(() => {
    if (open) setContent(initialContent);
  }, [open, initialContent]);

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

  const hasPlaceholder = content.includes(NAME_PLACEHOLDER);
  const sendLabel =
    subscriberCount === null
      ? "Send Newsletter"
      : `Send to ${subscriberCount} subscriber${subscriberCount === 1 ? "" : "s"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onCancel} />
      <div className="relative bg-white rounded-xl border border-[#d1cbc6] shadow-lg w-full max-w-2xl p-5 max-h-[90vh] flex flex-col">
        <h3 className="text-sm font-semibold text-[#1a1a1a] mb-1">Review &amp; Send Newsletter</h3>
        <p className="text-xs text-[#5a5550] mb-3">
          Review the content below. Edit the sign-off name or make any final changes before sending.
        </p>

        {hasPlaceholder && (
          <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-800">
              Please replace {NAME_PLACEHOLDER} with the sender&apos;s name before sending.
            </p>
          </div>
        )}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          disabled={busy}
          className={`w-full flex-1 min-h-[280px] rounded-lg border px-3 py-2 text-xs leading-relaxed bg-white font-mono focus:outline-none focus:ring-2 focus:ring-[#1f1823] disabled:opacity-60 ${
            hasPlaceholder ? "border-amber-400 ring-1 ring-amber-200" : "border-[#d1cbc6]"
          }`}
        />

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
            onClick={() => onSend(content)}
            disabled={busy || !content.trim() || subscriberCount === 0}
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
