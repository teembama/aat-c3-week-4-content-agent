"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ContentRequest } from "@/types";
import { IntakeForm } from "@/components/IntakeForm";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "text-[#5a5550]", bg: "bg-[#e8e3df]" },
  researching: { label: "Researching", color: "text-[#3b6fa0]", bg: "bg-blue-50" },
  generating: { label: "Generating", color: "text-[#6b4fa0]", bg: "bg-purple-50" },
  evaluating: { label: "Evaluating", color: "text-[#b5760a]", bg: "bg-amber-50" },
  revising: { label: "Revising", color: "text-[#b5760a]", bg: "bg-orange-50" },
  adapting: { label: "Adapting", color: "text-[#3b6fa0]", bg: "bg-cyan-50" },
  review: { label: "Needs Review", color: "text-[#b5760a]", bg: "bg-amber-50" },
  approved: { label: "Approved", color: "text-[#2d7a4f]", bg: "bg-green-50" },
  published: { label: "Published", color: "text-[#2d7a4f]", bg: "bg-emerald-50" },
  failed: { label: "Failed", color: "text-[#c43c3c]", bg: "bg-red-50" },
};

export default function DashboardPage() {
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function loadRequests() {
    const { data } = await supabase
      .from("content_requests").select("*").order("created_at", { ascending: false });
    setRequests((data as ContentRequest[]) || []);
    setLoading(false);
  }

  useEffect(() => { loadRequests(); }, []);

  // Pipeline counts
  const counts = {
    active: requests.filter((r) => ["researching", "generating", "evaluating", "revising", "adapting"].includes(r.status)).length,
    review: requests.filter((r) => r.status === "review").length,
    approved: requests.filter((r) => r.status === "approved").length,
    published: requests.filter((r) => r.status === "published").length,
    failed: requests.filter((r) => r.status === "failed").length,
  };

  const reviewItems = requests.filter((r) => r.status === "review");

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a1a]">Dashboard</h1>
          <p className="text-sm text-[#5a5550] mt-1">Your content pipeline at a glance.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#1f1823] text-white text-sm font-medium rounded-lg hover:bg-[#3d3347] transition-colors">
          {showForm ? "Cancel" : "+ New Content Request"}
        </button>
      </div>

      {showForm ? (
        <div className="mb-8">
          <IntakeForm onSuccess={() => { setShowForm(false); loadRequests(); }} />
        </div>
      ) : (
        <>
          {/* Pipeline summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
            {[
              { label: "In Progress", count: counts.active, color: "text-[#3b6fa0]", icon: "◉" },
              { label: "Needs Review", count: counts.review, color: "text-[#b5760a]", icon: "◉" },
              { label: "Approved", count: counts.approved, color: "text-[#2d7a4f]", icon: "◉" },
              { label: "Published", count: counts.published, color: "text-[#2d7a4f]", icon: "✓" },
              { label: "Failed", count: counts.failed, color: "text-[#c43c3c]", icon: "✗" },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-xl border border-[#d1cbc6] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-[#1a1a1a]">{item.count}</span>
                  <span className={`text-lg ${item.color}`}>{item.icon}</span>
                </div>
                <p className="text-xs text-[#8a847f] mt-1 font-medium">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Action required */}
          {reviewItems.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-[#1a1a1a] uppercase tracking-wider mb-3">
                Action Required
              </h2>
              <div className="space-y-2">
                {reviewItems.map((req) => (
                  <a key={req.id} href={`/request/${req.id}`}
                    className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-4 hover:bg-amber-100 transition-colors">
                    <div>
                      <p className="font-medium text-[#1a1a1a] text-sm">{req.topic}</p>
                      <p className="text-xs text-[#5a5550] mt-0.5">
                        {req.notifications?.length > 0
                          ? req.notifications[req.notifications.length - 1].message
                          : "Waiting for your review"}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-[#b5760a] bg-amber-100 px-2.5 py-1 rounded-full">
                      Review →
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* All requests */}
          <div>
            <h2 className="text-sm font-semibold text-[#1a1a1a] uppercase tracking-wider mb-3">
              All Content Requests
            </h2>
            {loading ? (
              <div className="text-center py-12 text-[#8a847f]">Loading…</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-[#d1cbc6]">
                <p className="text-[#8a847f] mb-3">No content requests yet.</p>
                <button onClick={() => setShowForm(true)} className="text-[#1f1823] font-medium hover:underline">
                  Create your first request →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {requests.map((req) => {
                  const status = STATUS_LABELS[req.status] || STATUS_LABELS.draft;
                  const hasWarnings = req.notifications?.some((n) => n.level === "warning" || n.level === "error");
                  return (
                    <a key={req.id} href={`/request/${req.id}`}
                      className="flex items-center justify-between bg-white border border-[#d1cbc6] rounded-lg p-4 hover:border-[#8a847f] hover:shadow-sm transition-all">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-[#1a1a1a] text-sm truncate">{req.topic}</h3>
                          {hasWarnings && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-[#8a847f] mt-0.5">
                          {req.audience} · {new Date(req.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.color} flex-shrink-0`}>
                        {status.label}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
