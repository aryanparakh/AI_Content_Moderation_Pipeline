import { DEFAULT_POLICIES } from "../config/policies.js";
import type {
  FeedbackExample,
  ModerationRecord,
  PlatformPolicy,
  ReviewOutcome,
} from "../types.js";

// ---------------------------------------------------------------------------
// Simple in-memory store. For an academic / demo deployment this keeps the
// system dependency-free and trivially resettable. Swapping in SQLite/Postgres
// would only mean reimplementing this module's interface.
// ---------------------------------------------------------------------------

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

class Store {
  private policies = new Map<string, PlatformPolicy>();
  private records = new Map<string, ModerationRecord>();
  private feedback: FeedbackExample[] = [];
  private seq = 0;

  constructor() {
    for (const p of DEFAULT_POLICIES) this.policies.set(p.id, clone(p));
  }

  nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${Date.now().toString(36)}_${this.seq}`;
  }

  // --- Policies ---
  listPolicies(): PlatformPolicy[] {
    return [...this.policies.values()];
  }
  getPolicy(id: string): PlatformPolicy | undefined {
    return this.policies.get(id);
  }
  upsertPolicy(policy: PlatformPolicy): PlatformPolicy {
    this.policies.set(policy.id, clone(policy));
    return this.getPolicy(policy.id)!;
  }
  resetPolicies(): void {
    this.policies.clear();
    for (const p of DEFAULT_POLICIES) this.policies.set(p.id, clone(p));
  }

  // --- Records ---
  saveRecord(record: ModerationRecord): ModerationRecord {
    this.records.set(record.id, record);
    return record;
  }
  getRecord(id: string): ModerationRecord | undefined {
    return this.records.get(id);
  }
  listRecords(): ModerationRecord[] {
    return [...this.records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  /** Items routed to human review that have not yet been reviewed. */
  listQueue(): ModerationRecord[] {
    return this.listRecords().filter(
      (r) => r.decision.routing === "human_review" && !r.review
    );
  }

  // --- Reviews / feedback ---
  applyReview(id: string, outcome: ReviewOutcome): ModerationRecord | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;
    record.review = outcome;
    this.feedback.push({
      recordId: record.id,
      content: record.content,
      context: record.context,
      aiAction: record.decision.action,
      humanAction: outcome.finalAction,
      notes: outcome.notes,
      createdAt: outcome.reviewedAt,
    });
    return record;
  }
  listFeedback(): FeedbackExample[] {
    return [...this.feedback].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // --- Stats (for the dashboard) ---
  stats() {
    const records = this.listRecords();
    const reviewed = records.filter((r) => r.review);
    const overrides = reviewed.filter((r) => r.review!.overrodeAI);
    return {
      totalProcessed: records.length,
      autoAllowed: records.filter((r) => r.decision.routing === "auto_allow").length,
      autoBlocked: records.filter((r) => r.decision.routing === "auto_block").length,
      queued: records.filter((r) => r.decision.routing === "human_review").length,
      pendingReview: this.listQueue().length,
      reviewed: reviewed.length,
      humanOverrides: overrides.length,
      // Agreement rate between AI aggregate action and the human final action.
      aiHumanAgreement:
        reviewed.length === 0
          ? null
          : Math.round(((reviewed.length - overrides.length) / reviewed.length) * 100) / 100,
    };
  }
}

export const store = new Store();
