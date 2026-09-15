import {
  PipelineNotification,
  PipelineStage,
  NotificationLevel,
} from "@/types";

/**
 * Create a pipeline notification with a unique ID and timestamp.
 * These accumulate per-request and are stored in Supabase so the user
 * can see the full history of what happened during their request.
 */
export function createNotification(
  level: NotificationLevel,
  stage: PipelineStage,
  message: string,
  detail?: string
): PipelineNotification {
  return {
    id: `${stage}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    level,
    message,
    detail,
    stage,
    timestamp: new Date().toISOString(),
  };
}

// ── Convenience factories ──

export function info(stage: PipelineStage, message: string, detail?: string) {
  return createNotification("info", stage, message, detail);
}

export function warn(stage: PipelineStage, message: string, detail?: string) {
  return createNotification("warning", stage, message, detail);
}

export function error(stage: PipelineStage, message: string, detail?: string) {
  return createNotification("error", stage, message, detail);
}

export function success(
  stage: PipelineStage,
  message: string,
  detail?: string
) {
  return createNotification("success", stage, message, detail);
}
