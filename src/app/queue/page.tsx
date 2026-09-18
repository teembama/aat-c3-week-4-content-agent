"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import { AuthGuard } from "@/components/AuthGuard";
import { ConfirmModal, ConfirmTone } from "@/components/ConfirmModal";
import { CopyButton } from "@/components/CopyButton";
import { useAuth, getAuthHeaders } from "@/lib/auth-context";
import { PublishingQueueItem } from "@/types";

interface QueueRow extends PublishingQueueItem {
  content_requests?: { topic: string } | null;
}

interface PendingAction {
  title: string;
  description: string;
  tone: ConfirmTone;
  confirmLabel?: string;
  run: () => Promise<void> | void;
}

const STATUS_ORDER = ["pending_review", "approved", "published", "rejected"];
const STATUS_LABELS: Record<string, string> = {
  pending_review: "Pending Review",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
};

function channelLabel(channel: string): string {
  return channel === "x" ? "X (Twitter)" : channel.charAt(0).toUpperCase() + channel.slice(1);
}

function copyLabel(channel: string): string {
  if (channel === "newsletter") return "Newsletter";
  if (channel === "x") return "X content";
  return "LinkedIn content";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function QueueContent() {
  const { profile } = useAuth();
  const isApprover = profile?.role === "approver";
  const [items, setItems] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const loadQueue = useCallback(async () => {
    const { data, error } = await supabase
      .from("publishing_queue")
      .select("*, content_requests(topic)")
      .order("created_at", { ascending: false });
    if (!error) setItems((data as unknown as QueueRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 4000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  async function handleConfirmRun() {
    if (!pendingAction) return;
    setConfirmBusy(true);
    try {
      await pendingAction.run();
    } finally {
      setConfirmBusy(false);
      setPendingAction(null);
    }
  }

  async function handleQueueAction(queueId: string, action: string) {
    setActionLoading(queueId);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ queue_id: queueId, action }),
      });
      const json = await res.json();
      const SUCCESS_LABELS: Record<string, string> = {
        approve: "Approved.",
        publish: "Published.",
        reject: "Rejected.",
        unpublish: "Unpublished.",
        unapprove: "Approval revoked.",
      };
      if (json.success) toast.success(SUCCESS_LABELS[action] || "Done.");
      else toast.error(json.error || "Failed.");
      loadQueue();
    } catch {
      toast.error("Network error.");
    } finally {
      setActionLoading(null);
    }
  }

  const sorted = [...items].sort((a, b) => {
    const diff = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={!!pendingAction}
        title={pendingAction?.title || ""}
        description={pendingAction?.description || ""}
        tone={pendingAction?.tone || "default"}
        confirmLabel={pendingAction?.confirmLabel}
        busy={confirmBusy}
        onConfirm={handleConfirmRun}
        onCancel={() => setPendingAction(null)}
      />

      <div>
        <h1 className="text-2xl font-bold text-[#1a1a1a]">Publishing Queue</h1>
        <p className="text-sm text-[#5a5550] mt-1">All channel outputs across every content request.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#8a847f]">Loading…</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-[#d1cbc6] text-[#8a847f]">
          No channel outputs yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((q) => (
            <div key={q.id} className="bg-white rounded-xl border border-[#d1cbc6] p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-[#1a1a1a] text-sm">{channelLabel(q.channel)}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      q.status === "published" ? "bg-emerald-100 text-emerald-800"
                        : q.status === "approved" ? "bg-green-100 text-green-800"
                        : q.status === "rejected" ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"}`}>
                      {STATUS_LABELS[q.status] || q.status}
                    </span>
                  </div>
                  <a href={`/request/${q.request_id}`} className="text-xs text-[#3b6fa0] hover:underline">
                    {q.content_requests?.topic || "Untitled request"}
                  </a>
                  {q.subject_line && <p className="text-xs font-medium text-[#5a5550] mt-1">Subject: {q.subject_line}</p>}
                </div>
                <div className="text-right text-[10px] text-[#8a847f] flex-shrink-0 space-y-0.5">
                  <p>Created {formatDate(q.created_at)}</p>
                  {q.approved_at && <p>Approved {formatDate(q.approved_at)}</p>}
                  {q.published_at && <p>Published {formatDate(q.published_at)}</p>}
                </div>
              </div>

              <div className="flex items-center justify-end mb-1.5">
                <CopyButton text={q.formatted_content} label={copyLabel(q.channel)} />
              </div>
              <div className="text-xs text-[#5a5550] whitespace-pre-wrap max-h-32 overflow-y-auto border border-[#e8e3df] rounded-lg p-3 bg-[#faf9f8] mb-3">
                {q.formatted_content}
              </div>

              <div className="flex gap-2 flex-wrap">
                {q.status === "pending_review" && (
                  isApprover ? (
                    <>
                      <button onClick={() => setPendingAction({
                        title: "Approve content?",
                        description: `Approve this ${channelLabel(q.channel)} content for publishing?`,
                        tone: "approve",
                        confirmLabel: "Approve",
                        run: () => handleQueueAction(q.id, "approve"),
                      })} disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-[#2d7a4f] text-white text-xs font-medium rounded-lg hover:bg-[#246b42] disabled:opacity-50">Approve</button>
                      <button onClick={() => setPendingAction({
                        title: "Reject content?",
                        description: `Reject this ${channelLabel(q.channel)} content? An approver can reverse this.`,
                        tone: "reject",
                        confirmLabel: "Reject",
                        run: () => handleQueueAction(q.id, "reject"),
                      })} disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-red-50 text-[#c43c3c] text-xs font-medium rounded-lg hover:bg-red-100 disabled:opacity-50 border border-red-200">Reject</button>
                    </>
                  ) : (
                    <p className="text-xs text-[#8a847f] italic">An approver needs to review this content.</p>
                  )
                )}
                {q.status === "approved" && (
                  isApprover ? (
                    <>
                      <button onClick={() => setPendingAction({
                        title: "Mark as published?",
                        description: `Mark this ${channelLabel(q.channel)} as published? A notification will be sent to the team Discord.`,
                        tone: "approve",
                        confirmLabel: "Mark Published",
                        run: () => handleQueueAction(q.id, "publish"),
                      })} disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-[#2d7a4f] text-white text-xs font-medium rounded-lg hover:bg-[#246b42] disabled:opacity-50">Mark Published</button>
                      <button onClick={() => setPendingAction({
                        title: "Revoke approval?",
                        description: `Revoke approval for this ${channelLabel(q.channel)} content? It will return to pending review.`,
                        tone: "danger",
                        confirmLabel: "Revoke Approval",
                        run: () => handleQueueAction(q.id, "unapprove"),
                      })} disabled={!!actionLoading}
                        className="px-3 py-1.5 text-xs font-medium text-[#b5760a] border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50">Revoke Approval</button>
                    </>
                  ) : (
                    <p className="text-xs text-[#8a847f] italic">An approver needs to review this content.</p>
                  )
                )}
                {q.status === "published" && isApprover && (
                  <button onClick={() => setPendingAction({
                    title: "Unpublish content?",
                    description: `Unpublish this ${channelLabel(q.channel)}? The team will be notified.`,
                    tone: "danger",
                    confirmLabel: "Unpublish",
                    run: () => handleQueueAction(q.id, "unpublish"),
                  })} disabled={!!actionLoading}
                    className="px-3 py-1.5 text-xs font-medium text-[#b5760a] border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50">Unpublish</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function QueuePage() {
  return (
    <AuthGuard>
      <QueueContent />
    </AuthGuard>
  );
}
