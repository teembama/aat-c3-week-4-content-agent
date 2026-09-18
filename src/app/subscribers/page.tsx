"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AuthGuard } from "@/components/AuthGuard";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useAuth, getAuthHeaders } from "@/lib/auth-context";

interface Subscriber {
  id: string;
  email: string;
  created_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function SubscribersContent() {
  const { profile } = useAuth();
  const isApprover = profile?.role === "approver";
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Subscriber | null>(null);

  const loadSubscribers = useCallback(async () => {
    try {
      const res = await fetch("/api/subscribers", { headers: { ...(await getAuthHeaders()) } });
      const json = await res.json();
      if (json.success) setSubscribers(json.data || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSubscribers(); }, [loadSubscribers]);

  async function addSubscriber(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setBusy("add");
    try {
      const res = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      const json = await res.json();
      if (json.success) { toast.success("Subscriber added."); setEmailInput(""); }
      else toast.error(json.error || "Failed to add subscriber.");
      loadSubscribers();
    } catch { toast.error("Network error."); }
    finally { setBusy(null); }
  }

  async function removeSubscriber(sub: Subscriber) {
    setBusy(sub.id);
    try {
      const res = await fetch("/api/subscribers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ id: sub.id }),
      });
      const json = await res.json();
      if (json.success) toast.success("Subscriber removed.");
      else toast.error(json.error || "Failed to remove subscriber.");
      loadSubscribers();
    } catch { toast.error("Network error."); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={!!pendingRemove}
        title="Remove subscriber?"
        description={`${pendingRemove?.email} will stop receiving the newsletter. You can add them again later.`}
        tone="danger"
        confirmLabel="Remove"
        onConfirm={() => {
          const sub = pendingRemove;
          setPendingRemove(null);
          if (sub) removeSubscriber(sub);
        }}
        onCancel={() => setPendingRemove(null)}
      />

      <div>
        <h1 className="text-2xl font-bold text-[#1a1a1a]">Subscribers</h1>
        <p className="text-sm text-[#5a5550] mt-1">
          People who receive the newsletter when a newsletter channel is published.
        </p>
      </div>

      {isApprover && (
        <form onSubmit={addSubscriber} className="bg-white rounded-xl border border-[#d1cbc6] p-5">
          <label htmlFor="email" className="block text-sm font-medium text-[#1a1a1a] mb-1">
            Add a subscriber
          </label>
          <div className="flex gap-2">
            <input id="email" type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
              placeholder="person@company.com"
              className="flex-1 rounded-lg border border-[#d1cbc6] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f1823] focus:border-transparent" />
            <button type="submit" disabled={busy === "add" || !emailInput.trim()}
              className="px-4 py-2 bg-[#1f1823] text-white text-sm font-medium rounded-lg hover:bg-[#3d3347] disabled:opacity-50 transition-colors">
              {busy === "add" ? "Adding…" : "Add Subscriber"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-[#d1cbc6] p-5">
        <h2 className="text-sm font-semibold text-[#1a1a1a] uppercase tracking-wider mb-3">
          Active Subscribers ({subscribers.length})
        </h2>

        {loading ? (
          <div className="text-center py-8 text-[#8a847f]">Loading…</div>
        ) : subscribers.length === 0 ? (
          <p className="text-sm text-[#8a847f] py-6 text-center">
            No subscribers yet.{isApprover ? " Add one above to start sending." : ""}
          </p>
        ) : isApprover ? (
          <div className="space-y-2">
            {subscribers.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 border border-[#e8e3df] rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-[#1a1a1a] truncate">{s.email}</p>
                  <p className="text-xs text-[#8a847f] mt-0.5">Added {formatDate(s.created_at)}</p>
                </div>
                <button onClick={() => setPendingRemove(s)} disabled={busy === s.id}
                  className="px-3 py-1.5 text-xs font-medium text-[#c43c3c] border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 flex-shrink-0">
                  {busy === s.id ? "Removing…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          // Creators see the size of the list, not the addresses.
          <p className="text-sm text-[#5a5550]">
            {subscribers.length} active subscriber{subscribers.length === 1 ? "" : "s"} will receive the newsletter.
            Only approvers can add or remove subscribers.
          </p>
        )}
      </div>
    </div>
  );
}

export default function SubscribersPage() {
  return (
    <AuthGuard>
      <SubscribersContent />
    </AuthGuard>
  );
}
