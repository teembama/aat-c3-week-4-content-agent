"use client";

export type ConfirmTone = "default" | "approve" | "reject" | "danger";

const TONE_BUTTON_CLASS: Record<ConfirmTone, string> = {
  default: "bg-[#1f1823] hover:bg-[#3d3347]",
  approve: "bg-[#2d7a4f] hover:bg-[#246b42]",
  reject: "bg-[#c43c3c] hover:bg-[#a83232]",
  danger: "bg-[#b5760a] hover:bg-[#9c6408]",
};

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable confirmation dialog. Renders nothing when `open` is false, so it
 * can be mounted unconditionally near the action it guards.
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onCancel} />
      <div className="relative bg-white rounded-xl border border-[#d1cbc6] shadow-lg max-w-sm w-full p-5">
        <h3 className="text-sm font-semibold text-[#1a1a1a] mb-2">{title}</h3>
        <p className="text-sm text-[#5a5550] mb-5">{description}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-[#5a5550] border border-[#d1cbc6] rounded-lg hover:bg-[#e8e3df] disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${TONE_BUTTON_CLASS[tone]}`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
