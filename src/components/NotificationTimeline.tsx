"use client";

import { PipelineNotification } from "@/types";

const LEVEL_STYLES = {
  info: {
    dot: "bg-blue-500",
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-100",
  },
  warning: {
    dot: "bg-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-100",
  },
  error: {
    dot: "bg-red-500",
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-100",
  },
  success: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-100",
  },
};

interface NotificationTimelineProps {
  notifications: PipelineNotification[];
}

export function NotificationTimeline({
  notifications,
}: NotificationTimelineProps) {
  if (!notifications || notifications.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No pipeline events yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((n) => {
        const style = LEVEL_STYLES[n.level] || LEVEL_STYLES.info;
        return (
          <div
            key={n.id}
            className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${style.bg} ${style.border}`}
          >
            <span
              className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${style.text}`}>{n.message}</p>
              {n.detail && (
                <p className="text-xs text-gray-600 mt-0.5">{n.detail}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {n.stage} ·{" "}
                {new Date(n.timestamp).toLocaleTimeString("en-NG", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
