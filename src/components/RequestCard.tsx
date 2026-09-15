"use client";

import { ContentRequest, RequestStatus } from "@/types";

const STATUS_CONFIG: Record<
  RequestStatus,
  { label: string; color: string; bg: string }
> = {
  draft: { label: "Draft", color: "text-gray-600", bg: "bg-gray-100" },
  researching: {
    label: "Researching",
    color: "text-blue-700",
    bg: "bg-blue-50",
  },
  generating: {
    label: "Generating",
    color: "text-purple-700",
    bg: "bg-purple-50",
  },
  evaluating: {
    label: "Evaluating",
    color: "text-amber-700",
    bg: "bg-amber-50",
  },
  revising: { label: "Revising", color: "text-orange-700", bg: "bg-orange-50" },
  adapting: { label: "Adapting", color: "text-cyan-700", bg: "bg-cyan-50" },
  review: {
    label: "Needs Review",
    color: "text-yellow-700",
    bg: "bg-yellow-50",
  },
  approved: { label: "Approved", color: "text-green-700", bg: "bg-green-50" },
  published: {
    label: "Published",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  failed: { label: "Failed", color: "text-red-700", bg: "bg-red-50" },
};

interface RequestCardProps {
  request: ContentRequest;
}

export function RequestCard({ request }: RequestCardProps) {
  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.draft;
  const hasWarnings = request.notifications?.some(
    (n) => n.level === "warning" || n.level === "error"
  );

  return (
    <a
      href={`/request/${request.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-900 truncate">
            {request.topic}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Audience: {request.audience}
          </p>
          <p className="text-xs text-gray-400 mt-1.5">
            {new Date(request.created_at).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {hasWarnings && (
            <span
              className="w-2 h-2 rounded-full bg-amber-400"
              title="Has warnings"
            />
          )}
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.color}`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Show latest notification if there is one */}
      {request.notifications?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            <span className="font-medium">Latest:</span>{" "}
            {request.notifications[request.notifications.length - 1].message}
          </p>
        </div>
      )}
    </a>
  );
}
