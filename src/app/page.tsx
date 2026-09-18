"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ContentRequest } from "@/types";
import { IntakeForm } from "@/components/IntakeForm";
import { AuthGuard } from "@/components/AuthGuard";

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

type FilterKey = "review" | "published" | "failed";

const FILTERS: Array<{
  key: FilterKey;
  label: string;
  statuses: string[];
  icon: string;
  text: string;
  activeBg: string;
  activeBorder: string;
}> = [
  {
    key: "review",
    label: "Needs Review",
    statuses: ["review"],
    icon: "◉",
    text: "text-[#b5760a]",
    activeBg: "bg-amber-50",
    activeBorder: "border-amber-400",
  },
  {
    key: "published",
    label: "Published",
    statuses: ["published", "approved"],
    icon: "✓",
    text: "text-[#2d7a4f]",
    activeBg: "bg-green-50",
    activeBorder: "border-green-400",
  },
  {
    key: "failed",
    label: "Failed",
    statuses: ["failed"],
    icon: "✗",
    text: "text-[#c43c3c]",
    activeBg: "bg-red-50",
    activeBorder: "border-red-400",
  },
];

function DashboardContent() {
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);

  async function loadRequests() {
    const { data } = await supabase
      .from("content_requests").select("*").order("created_at", { ascending: false });
    setRequests((data as ContentRequest[]) || []);
    setLoading(false);
  }

  useEffect(() => { loadRequests(); }, []);

  const reviewItems = requests.filter((r) => r.status === "review");

  const activeStatuses = FILTERS.find((f) => f.key === activeFilter)?.statuses;
  const visibleRequests = activeStatuses
    ? requests.filter((r) => activeStatuses.includes(r.status))
    : requests;

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
          {/* Pipeline filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {FILTERS.map((f) => {
              const count = requests.filter((r) => f.statuses.includes(r.status)).length;
              const isActive = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveFilter(isActive ? null : f.key)}
                  className={`text-left rounded-xl border p-4 transition-all hover:border-[#8a847f] hover:shadow-sm ${
                    isActive ? `${f.activeBg} ${f.activeBorder} ring-1 ring-inset ${f.activeBorder}` : "bg-white border-[#d1cbc6]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-[#1a1a1a]">{count}</span>
                    <span className={`text-lg ${f.text}`}>{f.icon}</span>
                  </div>
                  <p className="text-xs text-[#8a847f] mt-1 font-medium">{f.label}</p>
                </button>
              );
            })}
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
            <div className="flex items-center justify-between mb-3 gap-3">
              <h2 className="text-sm font-semibold text-[#1a1a1a] uppercase tracking-wider">
                {activeFilter ? FILTERS.find((f) => f.key === activeFilter)?.label : "All Content Requests"}
                {activeFilter && <span className="text-[#8a847f] font-medium normal-case"> ({visibleRequests.length})</span>}
              </h2>
              {activeFilter && (
                <button onClick={() => setActiveFilter(null)}
                  className="text-xs text-[#5a5550] hover:text-[#1a1a1a] underline flex-shrink-0">
                  Clear filter
                </button>
              )}
            </div>
            {loading ? (
              <div className="text-center py-12 text-[#8a847f]">Loading…</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-[#d1cbc6]">
                <p className="text-[#8a847f] mb-3">No content requests yet.</p>
                <button onClick={() => setShowForm(true)} className="text-[#1f1823] font-medium hover:underline">
                  Create your first request →
                </button>
              </div>
            ) : visibleRequests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-[#d1cbc6] text-[#8a847f]">
                No requests match this filter.
              </div>
            ) : (
              <div className="space-y-2">
                {visibleRequests.map((req) => {
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

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
