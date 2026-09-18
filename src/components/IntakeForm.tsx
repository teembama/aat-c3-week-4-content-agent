"use client";

import { useState, useRef } from "react";
import toast from "react-hot-toast";
import { ToneOption } from "@/types";
import { getAuthHeaders } from "@/lib/auth-context";

interface IntakeFormProps {
  onSuccess: () => void;
}

interface ValidationIssue {
  field: string;
  issue_type: string;
  severity: "error" | "warning";
  message: string;
  suggestion: string;
}

const KNOWN_FIELDS = ["topic", "audience", "source_url", "primary_keyword"];

const TONE_OPTIONS: { value: ToneOption; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
  { value: "technical", label: "Technical" },
  { value: "thought-leadership", label: "Thought Leadership" },
];

export function IntakeForm({ onSuccess }: IntakeFormProps) {
  const [step, setStep] = useState<"editing" | "warnings" | "submitting">("editing");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const [form, setForm] = useState({
    topic: "",
    audience: "",
    source_url: "",
    tone: "professional" as ToneOption,
    primary_keyword: "",
    additional_context: "",
  });

  // Either a full topic+audience pair, or a source URL we can derive them from.
  const canSubmit =
    (!!form.topic.trim() && !!form.audience.trim()) || !!form.source_url.trim();

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIssues((prev) => prev.filter((i) => i.field !== field));
  }

  function getFieldIssues(field: string): ValidationIssue[] {
    return issues.filter((i) => i.field === field);
  }

  function fieldBorderClass(field: string): string {
    const fieldIssues = getFieldIssues(field);
    if (fieldIssues.some((i) => i.severity === "error")) return "border-red-400 ring-1 ring-red-200";
    if (fieldIssues.some((i) => i.severity === "warning")) return "border-amber-400 ring-1 ring-amber-200";
    return "border-[#d1cbc6]";
  }

  function cancelSubmission() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStep("editing");
    toast("Submission cancelled.", { icon: "⏹" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIssues([]);
    setStep("editing");

    // ── Step 1: Validate ──
    try {
      const valRes = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const valData = await valRes.json();
      const allIssues: ValidationIssue[] = valData.issues || [];

      // Treat anything that isn't explicitly a "warning" as blocking — fail closed
      // rather than silently letting an unrecognized severity value through.
      const warnings = allIssues.filter((i) => i.severity === "warning");
      const errors = allIssues.filter((i) => i.severity !== "warning");

      if (errors.length > 0) {
        setIssues(allIssues);
        toast.error(`Please fix ${errors.length} issue${errors.length > 1 ? "s" : ""} before submitting.`);
        return;
      }

      if (warnings.length > 0) {
        // Show warnings and pause — user must click "Submit Anyway" to proceed
        setIssues(allIssues);
        setStep("warnings");
        return;
      }
    } catch {
      // If validation endpoint fails, don't block
    }

    // No issues — submit directly
    await doSubmit();
  }

  async function doSubmit() {
    setStep("submitting");
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          topic: form.topic.trim(),
          audience: form.audience.trim(),
          source_url: form.source_url.trim() || null,
          tone: form.tone,
          primary_keyword: form.primary_keyword.trim() || null,
          additional_context: form.additional_context.trim() || null,
        }),
        signal: abortRef.current.signal,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to submit request.");
        setStep("editing");
        return;
      }

      toast.success("Request submitted — research is starting.");
      onSuccess();
    } catch (err: any) {
      if (err?.name === "AbortError") {
        // User cancelled — already handled
        return;
      }
      toast.error("Network error. Please try again.");
      setStep("editing");
    }
  }

  function IssueDisplay({ field }: { field: string }) {
    const fieldIssues = getFieldIssues(field);
    if (fieldIssues.length === 0) return null;

    return (
      <>
        {fieldIssues.map((issue, idx) => (
          <div key={idx} className={`mt-1.5 rounded-lg p-2.5 ${
            issue.severity === "error" ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"
          }`}>
            <p className={`text-xs font-medium ${issue.severity === "error" ? "text-red-700" : "text-amber-700"}`}>
              {issue.severity === "error" ? "⚠ " : "💡 "}{issue.message}
            </p>
            {issue.suggestion && (
              <p className={`text-xs mt-1 ${issue.severity === "error" ? "text-red-500" : "text-amber-600"}`}>
                Suggestion: {issue.suggestion}
              </p>
            )}
          </div>
        ))}
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#d1cbc6] rounded-xl p-6 space-y-5">
      <h2 className="text-lg font-semibold text-[#1a1a1a]">New Content Request</h2>

      {/* General issues — includes multi-field issues like contradictions (e.g. field: "topic + audience") that don't map to a single input */}
      {issues.filter((i) => !KNOWN_FIELDS.includes(i.field)).map((issue, idx) => (
        <div key={idx} className={`rounded-lg p-3 ${
          issue.severity === "error" ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"
        }`}>
          <p className={`text-sm font-medium ${issue.severity === "error" ? "text-red-800" : "text-amber-800"}`}>
            {issue.message}
          </p>
          {issue.suggestion && (
            <p className={`text-xs mt-1 ${issue.severity === "error" ? "text-red-600" : "text-amber-600"}`}>
              {issue.suggestion}
            </p>
          )}
        </div>
      ))}

      {/* Warnings confirmation banner */}
      {step === "warnings" && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">We found some suggestions</p>
          <p className="text-xs text-amber-700 mb-3">
            These won't block your submission, but addressing them may improve the results. Review them below, then submit or go back to edit.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => doSubmit()}
              className="px-4 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700">
              Submit Anyway
            </button>
            <button type="button" onClick={() => setStep("editing")}
              className="px-4 py-1.5 bg-white text-amber-700 text-xs font-medium rounded-lg border border-amber-300 hover:bg-amber-50">
              Go Back & Edit
            </button>
          </div>
        </div>
      )}

      {/* Topic */}
      <div>
        <label htmlFor="topic" className="block text-sm font-medium text-[#1a1a1a] mb-1">
          Topic or idea <span className="text-[#8a847f] font-normal">(optional if you provide a source URL)</span>
        </label>
        <input id="topic" type="text" value={form.topic} onChange={(e) => update("topic", e.target.value)}
          placeholder='e.g. "How AI chatbots are transforming customer support for Nigerian SMEs"'
          className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f1823] focus:border-transparent ${fieldBorderClass("topic")}`}
        />
        <IssueDisplay field="topic" />
      </div>

      {/* Audience */}
      <div>
        <label htmlFor="audience" className="block text-sm font-medium text-[#1a1a1a] mb-1">
          Target audience <span className="text-[#8a847f] font-normal">(optional if you provide a source URL)</span>
        </label>
        <input id="audience" type="text" value={form.audience} onChange={(e) => update("audience", e.target.value)}
          placeholder="e.g. Marketing managers at mid-size B2B companies"
          className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f1823] focus:border-transparent ${fieldBorderClass("audience")}`}
        />
        <IssueDisplay field="audience" />
      </div>

      {/* Source URL */}
      <div>
        <label htmlFor="source_url" className="block text-sm font-medium text-[#1a1a1a] mb-1">
          Source URL <span className="text-[#8a847f] font-normal">(recommended)</span>
        </label>
        <input id="source_url" type="url" value={form.source_url} onChange={(e) => update("source_url", e.target.value)}
          placeholder="https://example.com/article"
          className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f1823] focus:border-transparent ${fieldBorderClass("source_url")}`}
        />
        <p className="text-xs text-[#8a847f] mt-1">Providing a source URL helps us write better-grounded content.</p>
        <IssueDisplay field="source_url" />
      </div>

      {/* Tone + Keyword */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="tone" className="block text-sm font-medium text-[#1a1a1a] mb-1">Tone</label>
          <select id="tone" value={form.tone} onChange={(e) => update("tone", e.target.value)}
            className="w-full rounded-lg border border-[#d1cbc6] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f1823]">
            {TONE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="primary_keyword" className="block text-sm font-medium text-[#1a1a1a] mb-1">
            Primary keyword <span className="text-[#8a847f] font-normal">(optional)</span>
          </label>
          <input id="primary_keyword" type="text" value={form.primary_keyword}
            onChange={(e) => update("primary_keyword", e.target.value)}
            placeholder="e.g. AI customer support"
            className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f1823] focus:border-transparent ${fieldBorderClass("primary_keyword")}`}
          />
          <IssueDisplay field="primary_keyword" />
        </div>
      </div>

      {/* Additional context */}
      <div>
        <label htmlFor="additional_context" className="block text-sm font-medium text-[#1a1a1a] mb-1">
          Additional context <span className="text-[#8a847f] font-normal">(optional)</span>
        </label>
        <textarea id="additional_context" rows={3} value={form.additional_context}
          onChange={(e) => update("additional_context", e.target.value)}
          placeholder="Any extra instructions, angles to emphasize, things to avoid…"
          className="w-full rounded-lg border border-[#d1cbc6] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f1823] resize-none"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        {step === "submitting" ? (
          <button type="button" onClick={cancelSubmission}
            className="px-6 py-2.5 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors">
            Cancel Submission
          </button>
        ) : (
          <button type="submit" disabled={step === "warnings" || !canSubmit}
            className="px-6 py-2.5 bg-[#1f1823] text-white text-sm font-medium rounded-lg hover:bg-[#3d3347] disabled:opacity-50 transition-colors">
            {step === "editing" ? "Start Research & Generation" : "Checking…"}
          </button>
        )}
      </div>

      {!canSubmit && step === "editing" && (
        <p className="text-xs text-[#8a847f]">
          Fill in both topic and target audience, or paste a source URL and we'll derive them for you.
        </p>
      )}

      {step === "submitting" && (
        <p className="text-xs text-[#8a847f] flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-[#8a847f] border-t-transparent rounded-full animate-spin inline-block" />
          Submitting and starting research…
        </p>
      )}
    </form>
  );
}
