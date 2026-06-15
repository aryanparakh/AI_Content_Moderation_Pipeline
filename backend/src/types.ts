// ---------------------------------------------------------------------------
// Core domain types for the content-moderation pipeline.
// These are shared by the classifier, policy engine, router, store and routes.
// ---------------------------------------------------------------------------

/** The seven harm categories the pipeline classifies against. */
export const HARM_CATEGORIES = [
  "hate_speech",
  "harassment",
  "spam",
  "misinformation",
  "graphic_violence",
  "adult_content",
  "self_harm",
] as const;

export type HarmCategory = (typeof HARM_CATEGORIES)[number];

/** Human-readable labels for UI / reports. */
export const CATEGORY_LABELS: Record<HarmCategory, string> = {
  hate_speech: "Hate speech",
  harassment: "Harassment",
  spam: "Spam",
  misinformation: "Misinformation",
  graphic_violence: "Graphic violence",
  adult_content: "Adult content",
  self_harm: "Self-harm",
};

/** Severity buckets the model assigns to a detected flag. */
export type Severity = "low" | "medium" | "high";

/**
 * One detected harm signal produced by the LLM classifier, before any policy
 * is applied. `segment` is the verbatim offending substring (explainability).
 */
export interface CategoryFlag {
  category: HarmCategory;
  /** Model confidence that this category is present, 0..1. */
  confidence: number;
  severity: Severity;
  /** The exact span of the content that triggered this flag. */
  segment: string;
  /** Why the model flagged this — auditable reasoning. */
  reasoning: string;
}

/** Raw, policy-independent output of the classifier. */
export interface ClassificationResult {
  flags: CategoryFlag[];
  /** One-line summary of the model's overall read of the content. */
  overallReasoning: string;
  /** How the supplied context (platform / history / thread) affected the call. */
  contextNotes: string;
  /** Model id that produced this result. */
  model: string;
  /** Wall-clock latency of the classification call, ms. */
  latencyMs: number;
}

// --------------------------- Context ---------------------------------------

/** Context the same statement is judged within. Drives context-aware analysis. */
export interface ModerationContext {
  /** Platform whose policy applies (must match a configured policy id). */
  platformId: string;
  /** Free-text description of the surface, e.g. "competitive gaming lobby". */
  surface?: string;
  /** Short summary of the author's history / standing. */
  userHistory?: string;
  /** Preceding messages in the thread, oldest first. */
  thread?: { author: string; text: string }[];
}

// --------------------------- Policy ----------------------------------------

/** Per-category rule within a platform policy. */
export interface CategoryPolicy {
  /** If false, this category is ignored entirely for the platform. */
  enabled: boolean;
  /** confidence >= this -> automatic action (block). 0..1 */
  autoActionThreshold: number;
  /** confidence in [reviewThreshold, autoActionThreshold) -> human review. 0..1 */
  reviewThreshold: number;
}

/** A custom keyword override rule. */
export interface CustomRule {
  id: string;
  description: string;
  /** Case-insensitive substring that triggers the rule. */
  contains: string;
  category: HarmCategory;
  /** Forced action when the phrase appears, regardless of model confidence. */
  action: "block" | "review" | "allow";
}

/** A complete platform policy. */
export interface PlatformPolicy {
  id: string;
  name: string;
  description: string;
  categories: Record<HarmCategory, CategoryPolicy>;
  customRules: CustomRule[];
}

// --------------------------- Decision --------------------------------------

export type Action = "allow" | "review" | "block";

/** Why a single flag resulted in its action — the explainability unit. */
export interface FlagDecision {
  category: HarmCategory;
  confidence: number;
  severity: Severity;
  segment: string;
  reasoning: string;
  /** Action this flag alone would trigger under the policy. */
  action: Action;
  /** Plain-English explanation of which threshold / rule decided it. */
  explanation: string;
}

/** The final, aggregated moderation decision for a piece of content. */
export interface ModerationDecision {
  /** Aggregate action = most severe action across all flags. */
  action: Action;
  /** "auto" when the system acted on its own; "queued" when sent for review. */
  routing: "auto_allow" | "auto_block" | "human_review";
  perFlag: FlagDecision[];
  /** The single flag that determined the aggregate action (if any). */
  primaryFlag: FlagDecision | null;
  summary: string;
}

// --------------------------- Records ---------------------------------------

/** A fully processed moderation request, stored for audit / queue. */
export interface ModerationRecord {
  id: string;
  content: string;
  context: ModerationContext;
  classification: ClassificationResult;
  decision: ModerationDecision;
  /** Snapshot of policy id + name used, for audit. */
  policyRef: { id: string; name: string };
  createdAt: string;
  /** Present once a human reviewer has acted on a queued item. */
  review?: ReviewOutcome;
}

/** A human reviewer's verdict on a queued item. */
export interface ReviewOutcome {
  reviewer: string;
  /** Final action the human chose. */
  finalAction: Action;
  /** Whether the human disagreed with the AI's aggregate action. */
  overrodeAI: boolean;
  notes?: string;
  reviewedAt: string;
}

/** Feedback derived from a review, usable as a labelled example for the model. */
export interface FeedbackExample {
  recordId: string;
  content: string;
  context: ModerationContext;
  aiAction: Action;
  humanAction: Action;
  notes?: string;
  createdAt: string;
}
