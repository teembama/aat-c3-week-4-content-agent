// ── Pipeline notification system ──
export type NotificationLevel = "info" | "warning" | "error" | "success";

export interface PipelineNotification {
  id: string;
  level: NotificationLevel;
  message: string;
  detail?: string;
  stage: PipelineStage;
  timestamp: string;
}

export type PipelineStage =
  | "intake"
  | "research"
  | "planning"
  | "generation"
  | "evaluation"
  | "revision"
  | "adaptation"
  | "review"
  | "publishing";

// ── Content request ──
export type RequestStatus =
  | "draft"
  | "researching"
  | "generating"
  | "evaluating"
  | "revising"
  | "adapting"
  | "review"
  | "approved"
  | "published"
  | "failed";

export type ToneOption =
  | "professional"
  | "conversational"
  | "technical"
  | "thought-leadership";

export interface ContentRequest {
  id: string;
  topic: string;
  audience: string;
  source_url?: string | null;
  tone: ToneOption;
  primary_keyword?: string | null;
  additional_context?: string | null;
  status: RequestStatus;
  notifications: PipelineNotification[];
  article_regeneration_count?: number;
  created_at: string;
  updated_at: string;
}

// ── Research sources ──
export type SourceType = "web_search" | "user_url";

export interface ResearchSource {
  id: string;
  request_id: string;
  url: string;
  title: string;
  content_markdown: string;
  relevance_score: number;
  key_claims: string[];
  source_type: SourceType;
  created_at: string;
}

export interface ResearchBrief {
  themes: string[];
  key_data_points: string[];
  source_gaps: string[];
  suggested_angles: string[];
  source_count: number;
}

// ── Content drafts ──
export type DraftStatus =
  | "draft"
  | "revised"
  | "selected"
  | "approved"
  | "rejected";

export interface EvaluationResult {
  overall_status: "pass" | "revise" | "reject";
  criteria: {
    topic_relevance: CriterionScore;
    source_grounding: CriterionScore;
    factual_consistency: CriterionScore;
    audience_fit: CriterionScore;
    tone: CriterionScore;
    seo_fit: CriterionScore;
    clarity: CriterionScore;
    completeness: CriterionScore;
  };
  weak_claims: string[];
  fabricated_content: string[];
  sections_needing_revision: string[];
  recommended_changes: string[];
}

export interface CriterionScore {
  score: number; // 1-5
  note: string;
}

export interface RevisionEntry {
  iteration: number;
  changes_made: string[];
  evaluation: EvaluationResult;
  revised_at: string;
}

export interface ContentDraft {
  id: string;
  request_id: string;
  draft_number: number;
  angle_description: string;
  article_markdown: string;
  article_html: string;
  source_references: string[];
  evaluation: EvaluationResult | null;
  revision_history: RevisionEntry[];
  status: DraftStatus;
  created_at: string;
}

// ── Publishing queue ──
export type Channel = "linkedin" | "x" | "newsletter";
export type PublishStatus =
  | "pending_review"
  | "approved"
  | "published"
  | "rejected";

export interface PublishingQueueItem {
  id: string;
  request_id: string;
  draft_id: string;
  channel: Channel;
  formatted_content: string;
  subject_line?: string | null; // newsletter only
  preview_data: Record<string, unknown>;
  status: PublishStatus;
  regeneration_count?: number;
  approved_by?: string | null;
  approved_at?: string | null;
  published_at?: string | null;
  created_at: string;
}

// ── API response shapes ──
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  notifications?: PipelineNotification[];
}
