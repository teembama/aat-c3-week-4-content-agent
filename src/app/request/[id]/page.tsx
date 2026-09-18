"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { NotificationTimeline } from "@/components/NotificationTimeline";
import { ProgressTracker } from "@/components/ProgressTracker";
import { AuthGuard } from "@/components/AuthGuard";
import { ConfirmModal, ConfirmTone } from "@/components/ConfirmModal";
import { useAuth, getAuthHeaders } from "@/lib/auth-context";
import { ContentRequest, ResearchSource, ContentDraft, PublishingQueueItem } from "@/types";

interface RequestData {
  request: ContentRequest;
  sources: ResearchSource[];
  drafts: ContentDraft[];
  queue: PublishingQueueItem[];
}

interface PendingAction {
  title: string;
  description: string;
  tone: ConfirmTone;
  confirmLabel?: string;
  run: () => Promise<void> | void;
}

const SOURCE_QUALITY: Record<string, { label: string; color: string }> = {
  user_url: { label: "Primary", color: "bg-green-100 text-green-800" },
  web_search: { label: "Secondary", color: "bg-blue-100 text-blue-800" },
};

function channelLabel(channel: string): string {
  return channel === "x" ? "X (Twitter)" : channel.charAt(0).toUpperCase() + channel.slice(1);
}

// Mirrors MAX_REGENERATIONS in src/app/api/regenerate-channel/route.ts
const MAX_REGENERATIONS = 2;

// Mirrors MAX_ARTICLE_REGENERATIONS in src/app/api/generate/route.ts
const MAX_ARTICLE_REGENERATIONS = 2;

function queueStatusLabel(q: PublishingQueueItem): string {
  if (q.status === "pending_review") return "Pending Review";
  if (q.status === "published" && q.channel === "newsletter") {
    const sent = (q.preview_data as any)?.sent_count;
    if (typeof sent === "number") return `Sent to ${sent} subscriber${sent === 1 ? "" : "s"}`;
  }
  return q.status.charAt(0).toUpperCase() + q.status.slice(1);
}

// Regeneration and the approve/reject actions both act on a queue item, so they
// need separate loading keys to label the right button while sharing a card.
const regenKey = (queueId: string) => `regen:${queueId}`;

function RequestDetailContent() {
  const params = useParams();
  const id = params.id as string;
  const { profile } = useAuth();
  const isApprover = profile?.role === "approver";
  const [data, setData] = useState<RequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const [addUrlInput, setAddUrlInput] = useState("");
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/status?id=${id}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {}
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Per-action loading keys, so one in-flight action doesn't disable the rest.
  function startLoading(actionId: string) {
    setActionLoading((prev) => new Set(prev).add(actionId));
  }
  function stopLoading(actionId: string) {
    setActionLoading((prev) => {
      const next = new Set(prev);
      next.delete(actionId);
      return next;
    });
  }
  function isLoading(actionId: string) {
    return actionLoading.has(actionId);
  }

  // Dismiss the dialog as soon as the action is dispatched rather than awaiting
  // it. The overlay covers the whole page, so holding it open for the duration
  // would serialize every action; per-button loading state reports progress.
  function handleConfirmRun() {
    if (!pendingAction) return;
    const { run } = pendingAction;
    setPendingAction(null);
    void run();
  }

  async function triggerGeneration() {
    startLoading("generate");
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) }, body: JSON.stringify({ request_id: id }) });
      const json = await res.json();
      if (json.success) toast.success("Articles generated."); else toast.error(json.error || "Generation failed.");
      loadData();
    } catch { toast.error("Network error."); }
    finally { stopLoading("generate"); }
  }

  async function regenerateAllArticles() {
    startLoading("regenerate_all");
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) }, body: JSON.stringify({ request_id: id }) });
      const json = await res.json();
      if (json.success) toast.success("Fresh article options ready."); else toast.error(json.error || "Regeneration failed.");
      loadData();
    } catch { toast.error("Network error."); }
    finally { stopLoading("regenerate_all"); }
  }

  async function addSourceUrl() {
    if (!addUrlInput.trim()) return;
    startLoading("add_url");
    try {
      const res = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ request_id: id, source_url: addUrlInput.trim() }) });
      const json = await res.json();
      if (json.success) { toast.success("Source added."); setAddUrlInput(""); } else toast.error(json.error || "Failed.");
      loadData();
    } catch { toast.error("Network error."); }
    finally { stopLoading("add_url"); }
  }

  async function selectDraft(draftId: string) {
    startLoading(draftId);
    try {
      const res = await fetch("/api/adapt", { method: "POST", headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) }, body: JSON.stringify({ request_id: id, draft_id: draftId }) });
      const json = await res.json();
      if (json.success) toast.success("Channel versions ready."); else toast.error(json.error || "Failed.");
      loadData();
    } catch { toast.error("Network error."); }
    finally { stopLoading(draftId); }
  }

  async function deselectDraft(draftId: string) {
    startLoading(draftId);
    try {
      const res = await fetch("/api/deselect", { method: "POST", headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) }, body: JSON.stringify({ request_id: id, draft_id: draftId }) });
      const json = await res.json();
      if (json.success) toast.success("Article deselected."); else toast.error(json.error || "Failed.");
      loadData();
    } catch { toast.error("Network error."); }
    finally { stopLoading(draftId); }
  }

  async function handleQueueAction(queueId: string, action: string) {
    startLoading(queueId);
    try {
      const res = await fetch("/api/publish", { method: "POST", headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) }, body: JSON.stringify({ queue_id: queueId, action }) });
      const json = await res.json();
      const SUCCESS_LABELS: Record<string, string> = {
        approve: "Approved.",
        publish: "Published.",
        reject: "Rejected.",
        unpublish: "Unpublished.",
        unapprove: "Approval revoked.",
        unreject: "Rejection undone — back in review.",
      };
      if (json.success) toast.success(SUCCESS_LABELS[action] || "Done.");
      else toast.error(json.error || "Failed.");
      loadData();
    } catch { toast.error("Network error."); }
    finally { stopLoading(queueId); }
  }

  async function regenerateChannel(q: PublishingQueueItem) {
    startLoading(regenKey(q.id));
    try {
      const res = await fetch("/api/regenerate-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ request_id: id, draft_id: q.draft_id, channel: q.channel }),
      });
      const json = await res.json();
      if (json.success) toast.success(`${channelLabel(q.channel)} regenerated — back in review.`);
      else toast.error(json.error || "Regeneration failed.");
      loadData();
    } catch { toast.error("Network error."); }
    finally { stopLoading(regenKey(q.id)); }
  }

  async function exportSamplePack() {
    if (!data) return;
    const pack = {
      input: { topic: data.request.topic, audience: data.request.audience, tone: data.request.tone, keyword: data.request.primary_keyword, source_url: data.request.source_url, additional_context: data.request.additional_context },
      sources: data.sources.map((s) => ({ title: s.title, url: s.url, type: s.source_type, claims: s.key_claims })),
      articles: data.drafts.map((d) => ({ option: d.draft_number, angle: d.angle_description, evaluation: d.evaluation?.overall_status, article: d.article_markdown })),
      channel_outputs: data.queue.map((q) => ({ channel: q.channel, status: q.status, content: q.formatted_content, subject_line: q.subject_line })),
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `content-sample-pack-${id.slice(0, 8)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Sample pack downloaded.");
  }

  if (loading) return <div className="text-center py-16 text-[#8a847f]">Loading…</div>;
  if (!data) return <div className="text-center py-16 text-[#8a847f]">Request not found.</div>;

  const { request, sources, drafts, queue } = data;
  const isProcessing = ["researching", "generating", "evaluating", "revising", "adapting"].includes(request.status);
  // Use only the most recent research outcome, not "ever happened" — otherwise an
  // early insufficiency warning permanently blocks generation even after enough
  // sources are added later and research subsequently succeeds.
  const researchMilestones = (request.notifications || []).filter((n: any) =>
    n.stage === "research" && (n.level === "success" || (n.level === "warning" && n.message?.includes("need more source material")))
  );
  const lastResearchMilestone = researchMilestones[researchMilestones.length - 1];
  const researchDone = lastResearchMilestone?.level === "success";
  const sourceInsufficient = lastResearchMilestone?.level === "warning";
  const showGenerateButton = !isProcessing && drafts.length === 0 && researchDone && !sourceInsufficient;
  const hasApprovedOrPublished = queue.some((q) => q.status === "approved" || q.status === "published");
  const articleRegensLeft = MAX_ARTICLE_REGENERATIONS - (request.article_regeneration_count ?? 0);

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={!!pendingAction}
        title={pendingAction?.title || ""}
        description={pendingAction?.description || ""}
        tone={pendingAction?.tone || "default"}
        confirmLabel={pendingAction?.confirmLabel}
        onConfirm={handleConfirmRun}
        onCancel={() => setPendingAction(null)}
      />

      {/* Header */}
      <div className="bg-white rounded-xl border border-[#d1cbc6] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <a href="/" className="text-xs text-[#8a847f] hover:text-[#1a1a1a] transition-colors mb-2 inline-block">← Dashboard</a>
            <h1 className="text-xl font-bold text-[#1a1a1a]">{request.topic}</h1>
            <div className="flex items-center gap-2 mt-2 text-xs text-[#5a5550]">
              <span>{request.audience}</span><span>·</span>
              <span className="capitalize">{request.tone}</span>
              {request.primary_keyword && (<><span>·</span><span>{request.primary_keyword}</span></>)}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {(drafts.length > 0 || queue.length > 0) && (
              <button onClick={exportSamplePack}
                className="px-3 py-1.5 text-xs font-medium text-[#5a5550] border border-[#d1cbc6] rounded-lg hover:bg-[#e8e3df] transition-colors">
                Export Sample Pack
              </button>
            )}
            <span className="text-xs text-[#8a847f] font-mono px-2 py-1.5">
              {id.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Progress tracker */}
        <div className="mt-5 pt-5 border-t border-[#e8e3df]">
          <ProgressTracker status={request.status} draftsExist={drafts.length > 0} queueExists={queue.length > 0} />
        </div>
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="bg-white border border-[#d1cbc6] rounded-xl p-5 text-center">
          <div className="flex items-center justify-center gap-3 text-[#3b6fa0]">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-medium">
              {request.status === "researching" && "Researching your topic…"}
              {request.status === "generating" && "Generating articles — usually takes 1-2 minutes…"}
              {request.status === "evaluating" && "Verifying claims against sources…"}
              {request.status === "revising" && "Improving drafts based on verification…"}
              {request.status === "adapting" && "Adapting for LinkedIn, X, and newsletter…"}
            </span>
          </div>
        </div>
      )}

      {/* Source insufficiency */}
      {sourceInsufficient && drafts.length === 0 && !isProcessing && (
        <div className="bg-white border-l-4 border-l-[#b5760a] border border-[#d1cbc6] rounded-r-xl p-5">
          <h3 className="font-semibold text-[#1a1a1a] text-sm mb-1">We need more source material</h3>
          <p className="text-xs text-[#5a5550] mb-4">
            We couldn't find enough reliable sources to write a well-grounded article. Add a source URL so we have solid material to work from.
          </p>
          <div className="flex gap-2">
            <input type="url" value={addUrlInput} onChange={(e) => setAddUrlInput(e.target.value)}
              placeholder="https://example.com/relevant-article"
              className="flex-1 rounded-lg border border-[#d1cbc6] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f1823]" />
            <button onClick={addSourceUrl} disabled={isLoading("add_url") || !addUrlInput.trim()}
              className="px-4 py-2 bg-[#1f1823] text-white text-sm font-medium rounded-lg hover:bg-[#3d3347] disabled:opacity-50 transition-colors">
              {isLoading("add_url") ? "Adding…" : "Add & Retry"}
            </button>
          </div>
        </div>
      )}

      {/* Generate button */}
      {showGenerateButton && (
        <div className="bg-white border border-[#d1cbc6] rounded-xl p-6 text-center">
          <p className="text-sm text-[#5a5550] mb-3">
            {request.status === "failed" ? "Previous generation failed. You can try again." : "Research complete. Ready to generate article options."}
          </p>
          <button onClick={triggerGeneration} disabled={isLoading("generate")}
            className="px-5 py-2.5 bg-[#1f1823] text-white text-sm font-medium rounded-lg hover:bg-[#3d3347] disabled:opacity-50 transition-colors">
            {isLoading("generate") ? "Generating — takes about 1-2 minutes…" : request.status === "failed" ? "Retry Generation" : "Generate Article Options"}
          </button>
        </div>
      )}

      {/* Article options */}
      {drafts.length > 0 && (
        <div className="bg-white rounded-xl border border-[#d1cbc6] p-5">
          <h2 className="text-sm font-semibold text-[#1a1a1a] uppercase tracking-wider mb-4">
            Article Options ({drafts.length})
          </h2>

          {/* Whole-set regeneration, for when none of the options are usable */}
          {request.status === "review" && !hasApprovedOrPublished && (
            <div className="mb-4 pb-4 border-b border-[#e8e3df]">
              {articleRegensLeft > 0 ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={() => setPendingAction({
                    title: "Regenerate all articles?",
                    description: `This will replace the current options with fresh ones. You have ${articleRegensLeft} of ${MAX_ARTICLE_REGENERATIONS} regenerations remaining. This cannot be undone.`,
                    tone: "danger",
                    confirmLabel: "Regenerate All",
                    run: regenerateAllArticles,
                  })} disabled={isLoading("regenerate_all")}
                    className="px-4 py-2 bg-[#1f1823] text-white text-xs font-medium rounded-lg hover:bg-[#3d3347] disabled:opacity-50 transition-colors">
                    {isLoading("regenerate_all") ? "Regenerating — takes about 1-2 minutes…" : "Regenerate All Articles"}
                  </button>
                  <span className="text-xs text-[#8a847f]">
                    ({articleRegensLeft}/{MAX_ARTICLE_REGENERATIONS} regenerations remaining)
                  </span>
                </div>
              ) : (
                <p className="text-xs text-[#8a847f]">Maximum regenerations reached</p>
              )}
            </div>
          )}

          <div className="space-y-5">
            {drafts.map((d) => {
              const cv = (d.evaluation as any)?.claim_verification;
              return (
                <div key={d.id} className="border border-[#e8e3df] rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-semibold text-[#1a1a1a]">Option {d.draft_number}: {d.angle_description}</h3>
                      {d.revision_history?.length > 0 && (
                        <p className="text-xs text-[#8a847f] mt-0.5">
                          Revised {d.revision_history.length}× · {d.revision_history.map((r: any, i: number) =>
                            `v${i + 1}`).join(" → ")} → final
                        </p>
                      )}
                    </div>
                    {d.evaluation && (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        d.evaluation.overall_status === "pass" ? "bg-green-100 text-green-800"
                          : d.evaluation.overall_status === "revise" ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"}`}>
                        {d.evaluation.overall_status === "pass" ? "Verified ✓" : d.evaluation.overall_status === "revise" ? "Flagged for Review" : "Issues Found"}
                      </span>
                    )}
                  </div>

                  {/* Claim verification summary */}
                  {cv && (
                    <div className="flex gap-2 mb-3">
                      <span className="text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded">✓ {cv.verified_count} verified</span>
                      {cv.unsupported_count > 0 && <span className="text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">⚠ {cv.unsupported_count} unsupported</span>}
                      {cv.fabricated_count > 0 && <span className="text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded">✗ {cv.fabricated_count} fabricated</span>}
                    </div>
                  )}

                  {/* Evaluation scores */}
                  {d.evaluation?.criteria && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {Object.entries(d.evaluation.criteria).map(([key, val]: [string, any]) => {
                        const score = typeof val === "number" ? val : val?.score;
                        const note = typeof val === "object" ? val?.note : "";
                        return (
                          <span key={key} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            score >= 4 ? "bg-green-50 text-green-700" : score >= 3 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}
                            title={note}>
                            {key.replace(/_/g, " ")}: {score}/5
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Article preview */}
                  <div className="prose prose-sm max-w-none max-h-60 overflow-y-auto border border-[#e8e3df] rounded-lg p-4 bg-[#faf9f8] text-[#1a1a1a]">
                    <div dangerouslySetInnerHTML={{ __html: d.article_html || d.article_markdown }} />
                  </div>

                  {/* Actions */}
                  {queue.length === 0 && !isProcessing && d.status !== "selected" && (
                    <button onClick={() => setPendingAction({
                      title: "Select this article?",
                      description: "Are you sure you want to select this article? This will generate LinkedIn, X, and newsletter versions.",
                      tone: "default",
                      confirmLabel: "Select & Adapt",
                      run: () => selectDraft(d.id),
                    })} disabled={isLoading(d.id)}
                      className="mt-3 px-4 py-2 bg-[#1f1823] text-white text-sm font-medium rounded-lg hover:bg-[#3d3347] disabled:opacity-50 transition-colors">
                      {isLoading(d.id) ? "Preparing…" : "Select & Adapt for Channels"}
                    </button>
                  )}
                  {d.status === "selected" && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="inline-block text-xs font-medium text-[#1f1823] bg-[#e8e3df] px-2.5 py-1 rounded-full">Selected ✓</span>
                      {queue.length > 0 && !hasApprovedOrPublished && (
                        <button onClick={() => setPendingAction({
                          title: "Deselect this article?",
                          description: "Deselect this article and remove channel adaptations? You can then pick a different option.",
                          tone: "danger",
                          confirmLabel: "Deselect",
                          run: () => deselectDraft(d.id),
                        })} disabled={isLoading(d.id)}
                          className="px-3 py-1.5 text-xs font-medium text-[#b5760a] border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors">
                          {isLoading(d.id) ? "Removing…" : "Deselect Article"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Channel outputs */}
      {queue.length > 0 && (
        <div className="bg-white rounded-xl border border-[#d1cbc6] p-5">
          <h2 className="text-sm font-semibold text-[#1a1a1a] uppercase tracking-wider mb-4">Channel Outputs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {queue.map((q) => {
              // Card-level: any action on this queue item blocks its siblings,
              // but leaves every other channel's buttons live.
              const busy = isLoading(q.id) || isLoading(regenKey(q.id));
              return (
              <div key={q.id} className="border border-[#e8e3df] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-[#1a1a1a] text-sm capitalize">
                    {q.channel === "x" ? "X (Twitter)" : q.channel}
                  </h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    q.status === "published" ? "bg-emerald-100 text-emerald-800"
                      : q.status === "approved" ? "bg-green-100 text-green-800"
                      : q.status === "rejected" ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"}`}>
                    {queueStatusLabel(q)}
                  </span>
                </div>
                {q.subject_line && <p className="text-xs font-medium text-[#5a5550] mb-2">Subject: {q.subject_line}</p>}
                <div className="text-xs text-[#5a5550] whitespace-pre-wrap max-h-44 overflow-y-auto border border-[#e8e3df] rounded-lg p-3 bg-[#faf9f8]">
                  {q.formatted_content}
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  {q.status === "pending_review" && (
                    isApprover ? (
                      <>
                        <button onClick={() => setPendingAction({
                          title: "Approve content?",
                          description: `Approve this ${channelLabel(q.channel)} content for publishing?`,
                          tone: "approve",
                          confirmLabel: "Approve",
                          run: () => handleQueueAction(q.id, "approve"),
                        })} disabled={busy}
                          className="px-3 py-1.5 bg-[#2d7a4f] text-white text-xs font-medium rounded-lg hover:bg-[#246b42] disabled:opacity-50">Approve</button>
                        <button onClick={() => setPendingAction({
                          title: "Reject content?",
                          description: `Reject this ${channelLabel(q.channel)} content? An approver can reverse this.`,
                          tone: "reject",
                          confirmLabel: "Reject",
                          run: () => handleQueueAction(q.id, "reject"),
                        })} disabled={busy}
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
                        })} disabled={busy}
                          className="px-3 py-1.5 bg-[#2d7a4f] text-white text-xs font-medium rounded-lg hover:bg-[#246b42] disabled:opacity-50">Mark Published</button>
                        <button onClick={() => setPendingAction({
                          title: "Revoke approval?",
                          description: `Revoke approval for this ${channelLabel(q.channel)} content? It will return to pending review.`,
                          tone: "danger",
                          confirmLabel: "Revoke Approval",
                          run: () => handleQueueAction(q.id, "unapprove"),
                        })} disabled={busy}
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
                    })} disabled={busy}
                      className="px-3 py-1.5 text-xs font-medium text-[#b5760a] border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50">Unpublish</button>
                  )}
                  {q.status === "rejected" && (() => {
                    const used = q.regeneration_count ?? 0;
                    const remaining = MAX_REGENERATIONS - used;
                    return (
                      <>
                        {remaining > 0 ? (
                          <button onClick={() => setPendingAction({
                            title: "Regenerate this channel?",
                            description: `Rewrite the ${channelLabel(q.channel)} version from the selected article and send it back for review. You have ${remaining} of ${MAX_REGENERATIONS} regenerations left for this channel.`,
                            tone: "default",
                            confirmLabel: "Regenerate",
                            run: () => regenerateChannel(q),
                          })} disabled={busy}
                            className="px-3 py-1.5 bg-[#1f1823] text-white text-xs font-medium rounded-lg hover:bg-[#3d3347] disabled:opacity-50">
                            {isLoading(regenKey(q.id)) ? "Regenerating…" : `Regenerate (${remaining}/${MAX_REGENERATIONS} remaining)`}
                          </button>
                        ) : (
                          <p className="text-xs text-[#8a847f] italic">Maximum regenerations reached — handle manually</p>
                        )}
                        {isApprover && (
                          <button onClick={() => setPendingAction({
                            title: "Undo rejection?",
                            description: `Return this ${channelLabel(q.channel)} content to pending review without regenerating it. The existing text is kept as-is.`,
                            tone: "default",
                            confirmLabel: "Undo Rejection",
                            run: () => handleQueueAction(q.id, "unreject"),
                          })} disabled={busy}
                            className="px-3 py-1.5 text-xs font-medium text-[#b5760a] border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50">Undo Rejection</button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Research sources */}
      {sources.length > 0 && (
        <div className="bg-white rounded-xl border border-[#d1cbc6] p-5">
          <h2 className="text-sm font-semibold text-[#1a1a1a] uppercase tracking-wider mb-3">
            Research Sources ({sources.length})
          </h2>
          <div className="space-y-3">
            {sources.map((s, i) => {
              const quality = SOURCE_QUALITY[s.source_type] || SOURCE_QUALITY.web_search;
              return (
                <div key={s.id} className="border border-[#e8e3df] rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono text-[#8a847f]">src_{String(i + 1).padStart(3, "0")}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${quality.color}`}>{quality.label}</span>
                      </div>
                      <p className="font-medium text-[#1a1a1a] text-sm">{s.title}</p>
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-[#3b6fa0] hover:underline truncate block">{s.url}</a>
                    </div>
                  </div>
                  {Array.isArray(s.key_claims) && s.key_claims.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#e8e3df]">
                      <p className="text-[10px] font-semibold text-[#8a847f] uppercase tracking-wider mb-1">Evidence Extracted</p>
                      <ul className="space-y-0.5">
                        {s.key_claims.map((c, ci) => (
                          <li key={ci} className="text-xs text-[#5a5550] flex gap-1.5">
                            <span className="text-[#2d7a4f] mt-0.5">•</span>{c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity history */}
      <div className="bg-white rounded-xl border border-[#d1cbc6] p-5">
        <button onClick={() => setShowAuditTrail(!showAuditTrail)}
          className="flex items-center justify-between w-full text-left">
          <h2 className="text-sm font-semibold text-[#1a1a1a] uppercase tracking-wider">
            Activity History ({request.notifications?.length || 0} events)
          </h2>
          <span className="text-xs text-[#8a847f]">{showAuditTrail ? "Hide" : "Show"}</span>
        </button>
        {showAuditTrail && (
          <div className="mt-3">
            <NotificationTimeline notifications={request.notifications || []} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function RequestDetailPage() {
  return (
    <AuthGuard>
      <RequestDetailContent />
    </AuthGuard>
  );
}
