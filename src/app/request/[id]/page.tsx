"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { NotificationTimeline } from "@/components/NotificationTimeline";
import { ProgressTracker } from "@/components/ProgressTracker";
import { ContentRequest, ResearchSource, ContentDraft, PublishingQueueItem } from "@/types";

interface RequestData {
  request: ContentRequest;
  sources: ResearchSource[];
  drafts: ContentDraft[];
  queue: PublishingQueueItem[];
}

const SOURCE_QUALITY: Record<string, { label: string; color: string }> = {
  user_url: { label: "Primary", color: "bg-green-100 text-green-800" },
  web_search: { label: "Secondary", color: "bg-blue-100 text-blue-800" },
};

export default function RequestDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<RequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [addUrlInput, setAddUrlInput] = useState("");
  const [showAuditTrail, setShowAuditTrail] = useState(false);

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

  async function triggerGeneration() {
    setActionLoading("generate");
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: id }) });
      const json = await res.json();
      if (json.success) toast.success("Articles generated."); else toast.error(json.error || "Generation failed.");
      loadData();
    } catch { toast.error("Network error."); }
    finally { setActionLoading(null); }
  }

  async function addSourceUrl() {
    if (!addUrlInput.trim()) return;
    setActionLoading("add_url");
    try {
      const res = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: id, source_url: addUrlInput.trim() }) });
      const json = await res.json();
      if (json.success) { toast.success("Source added."); setAddUrlInput(""); } else toast.error(json.error || "Failed.");
      loadData();
    } catch { toast.error("Network error."); }
    finally { setActionLoading(null); }
  }

  async function selectDraft(draftId: string) {
    setActionLoading(draftId);
    try {
      const res = await fetch("/api/adapt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: id, draft_id: draftId }) });
      const json = await res.json();
      if (json.success) toast.success("Channel versions ready."); else toast.error(json.error || "Failed.");
      loadData();
    } catch { toast.error("Network error."); }
    finally { setActionLoading(null); }
  }

  async function handleQueueAction(queueId: string, action: string) {
    setActionLoading(queueId);
    try {
      const res = await fetch("/api/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ queue_id: queueId, action }) });
      const json = await res.json();
      if (json.success) toast.success(action === "approve" ? "Approved." : action === "publish" ? "Published." : "Rejected.");
      else toast.error(json.error || "Failed.");
      loadData();
    } catch { toast.error("Network error."); }
    finally { setActionLoading(null); }
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

  return (
    <div className="space-y-6">
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
            <button onClick={addSourceUrl} disabled={actionLoading === "add_url" || !addUrlInput.trim()}
              className="px-4 py-2 bg-[#1f1823] text-white text-sm font-medium rounded-lg hover:bg-[#3d3347] disabled:opacity-50 transition-colors">
              {actionLoading === "add_url" ? "Adding…" : "Add & Retry"}
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
          <button onClick={triggerGeneration} disabled={actionLoading === "generate"}
            className="px-5 py-2.5 bg-[#1f1823] text-white text-sm font-medium rounded-lg hover:bg-[#3d3347] disabled:opacity-50 transition-colors">
            {actionLoading === "generate" ? "Generating — takes about 1-2 minutes…" : request.status === "failed" ? "Retry Generation" : "Generate Article Options"}
          </button>
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

      {/* Article options */}
      {drafts.length > 0 && (
        <div className="bg-white rounded-xl border border-[#d1cbc6] p-5">
          <h2 className="text-sm font-semibold text-[#1a1a1a] uppercase tracking-wider mb-4">
            Article Options ({drafts.length})
          </h2>
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
                      {Object.entries(d.evaluation.criteria).map(([key, val]: [string, any]) => (
                        <span key={key} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          val.score >= 4 ? "bg-green-50 text-green-700" : val.score >= 3 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}
                          title={val.note}>
                          {key.replace(/_/g, " ")}: {val.score}/5
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Article preview */}
                  <div className="prose prose-sm max-w-none max-h-60 overflow-y-auto border border-[#e8e3df] rounded-lg p-4 bg-[#faf9f8] text-[#1a1a1a]">
                    <div dangerouslySetInnerHTML={{ __html: d.article_html || d.article_markdown }} />
                  </div>

                  {/* Actions */}
                  {queue.length === 0 && !isProcessing && d.status !== "selected" && (
                    <button onClick={() => selectDraft(d.id)} disabled={!!actionLoading}
                      className="mt-3 px-4 py-2 bg-[#1f1823] text-white text-sm font-medium rounded-lg hover:bg-[#3d3347] disabled:opacity-50 transition-colors">
                      {actionLoading === d.id ? "Preparing…" : "Select & Adapt for Channels"}
                    </button>
                  )}
                  {d.status === "selected" && (
                    <span className="inline-block mt-3 text-xs font-medium text-[#1f1823] bg-[#e8e3df] px-2.5 py-1 rounded-full">Selected ✓</span>
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
            {queue.map((q) => (
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
                    {q.status === "pending_review" ? "Pending Review" : q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                  </span>
                </div>
                {q.subject_line && <p className="text-xs font-medium text-[#5a5550] mb-2">Subject: {q.subject_line}</p>}
                <div className="text-xs text-[#5a5550] whitespace-pre-wrap max-h-44 overflow-y-auto border border-[#e8e3df] rounded-lg p-3 bg-[#faf9f8]">
                  {q.formatted_content}
                </div>
                <div className="mt-3 flex gap-2">
                  {q.status === "pending_review" && (
                    <>
                      <button onClick={() => handleQueueAction(q.id, "approve")} disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-[#2d7a4f] text-white text-xs font-medium rounded-lg hover:bg-[#246b42] disabled:opacity-50">Approve</button>
                      <button onClick={() => handleQueueAction(q.id, "reject")} disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-red-50 text-[#c43c3c] text-xs font-medium rounded-lg hover:bg-red-100 disabled:opacity-50 border border-red-200">Reject</button>
                    </>
                  )}
                  {q.status === "approved" && (
                    <button onClick={() => handleQueueAction(q.id, "publish")} disabled={!!actionLoading}
                      className="px-3 py-1.5 bg-[#2d7a4f] text-white text-xs font-medium rounded-lg hover:bg-[#246b42] disabled:opacity-50">Mark Published</button>
                  )}
                </div>
              </div>
            ))}
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
