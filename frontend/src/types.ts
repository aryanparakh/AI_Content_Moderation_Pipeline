// Mirrors the backend domain types (the subset the UI consumes).

export type HarmCategory =
  | "hate_speech"
  | "harassment"
  | "spam"
  | "misinformation"
  | "graphic_violence"
  | "adult_content"
  | "self_harm";

export type Severity = "low" | "medium" | "high";
export type Action = "allow" | "review" | "block";

export interface CategoryFlag {
  category: HarmCategory;
  confidence: number;
  severity: Severity;
  segment: string;
  reasoning: string;
}

export interface ClassificationResult {
  flags: CategoryFlag[];
  overallReasoning: string;
  contextNotes: string;
  model: string;
  latencyMs: number;
}

export interface ModerationContext {
  platformId: string;
  surface?: string;
  userHistory?: string;
  thread?: { author: string; text: string }[];
}

export interface CategoryPolicy {
  enabled: boolean;
  autoActionThreshold: number;
  reviewThreshold: number;
}

export interface CustomRule {
  id: string;
  description: string;
  contains: string;
  category: HarmCategory;
  action: Action;
}

export interface PlatformPolicy {
  id: string;
  name: string;
  description: string;
  categories: Record<HarmCategory, CategoryPolicy>;
  customRules: CustomRule[];
}

export interface FlagDecision {
  category: HarmCategory;
  confidence: number;
  severity: Severity;
  segment: string;
  reasoning: string;
  action: Action;
  explanation: string;
}

export interface ModerationDecision {
  action: Action;
  routing: "auto_allow" | "auto_block" | "human_review";
  perFlag: FlagDecision[];
  primaryFlag: FlagDecision | null;
  summary: string;
}

export interface ReviewOutcome {
  reviewer: string;
  finalAction: Action;
  overrodeAI: boolean;
  notes?: string;
  reviewedAt: string;
}

export interface ModerationRecord {
  id: string;
  content: string;
  context: ModerationContext;
  classification: ClassificationResult;
  decision: ModerationDecision;
  policyRef: { id: string; name: string };
  createdAt: string;
  review?: ReviewOutcome;
}

export interface FeedbackExample {
  recordId: string;
  content: string;
  context: ModerationContext;
  aiAction: Action;
  humanAction: Action;
  notes?: string;
  createdAt: string;
}

export interface Stats {
  totalProcessed: number;
  autoAllowed: number;
  autoBlocked: number;
  queued: number;
  pendingReview: number;
  reviewed: number;
  humanOverrides: number;
  aiHumanAgreement: number | null;
}

export interface CategoryMeta {
  id: HarmCategory;
  label: string;
}
