"use client";

import { RequestStatus } from "@/types";

const STAGES = [
  { key: "research", label: "Research" },
  { key: "generate", label: "Generate" },
  { key: "evaluate", label: "Evaluate" },
  { key: "adapt", label: "Adapt" },
  { key: "review", label: "Review" },
  { key: "publish", label: "Publish" },
];

function getActiveIndex(status: RequestStatus, draftsExist: boolean, queueExists: boolean): number {
  switch (status) {
    case "draft":
      return -1;
    case "researching":
      return 0;
    case "generating":
      return 1;
    case "evaluating":
    case "revising":
      return 2;
    case "adapting":
      return 3;
    case "review":
      // Research done but no drafts = still at generate step
      if (!draftsExist) return 1;
      // Drafts exist but no queue = waiting for selection
      if (!queueExists) return 4;
      return 4;
    case "approved":
      return 5;
    case "published":
      return 6; // past the end = all complete
    case "failed":
      return -2;
    default:
      return -1;
  }
}

interface ProgressTrackerProps {
  status: RequestStatus;
  draftsExist: boolean;
  queueExists: boolean;
}

export function ProgressTracker({ status, draftsExist, queueExists }: ProgressTrackerProps) {
  const activeIndex = getActiveIndex(status, draftsExist, queueExists);

  if (status === "failed") {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-100">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="text-sm font-medium text-red-700">
          Pipeline encountered an error — check events below for details.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STAGES.map((stage, i) => {
        const isComplete = i < activeIndex;
        const isCurrent = i === activeIndex;
        const isPending = i > activeIndex;

        return (
          <div key={stage.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  isComplete
                    ? "bg-green-500 text-white"
                    : isCurrent
                      ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                      : "bg-gray-200 text-gray-400"
                }`}
              >
                {isComplete ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs mt-1 whitespace-nowrap ${
                  isCurrent
                    ? "text-indigo-700 font-semibold"
                    : isComplete
                      ? "text-green-700 font-medium"
                      : "text-gray-400"
                }`}
              >
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={`w-8 sm:w-12 h-0.5 mx-1 mt-[-12px] ${
                  isComplete ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
