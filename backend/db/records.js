import { dbGet, dbAll } from './query.js';

/**
 * Converts a raw SQLite row into a clean API response object,
 * including the review outcome if one exists.
 */
export function buildRecord(row) {
  if (!row) return null;
  const review = dbGet('SELECT * FROM review_outcomes WHERE record_id = ?', [row.id]);

  return {
    id: row.id,
    content: row.content,
    context: {
      platformId: row.platform_id,
      surface: row.surface || undefined,
      userHistory: row.user_history || undefined,
      thread: JSON.parse(row.thread || '[]'),
    },
    classification: {
      flags: JSON.parse(row.flags || '[]'),
      overallReasoning: row.overall_reasoning || '',
      contextNotes: row.context_notes || '',
      model: row.model_used || '',
      latencyMs: row.latency_ms || 0,
    },
    decision: {
      action: row.action,
      routing: row.routing,
      perFlag: JSON.parse(row.per_flag || '[]'),
      primaryFlag: row.primary_flag ? JSON.parse(row.primary_flag) : null,
      summary: row.decision_summary || '',
    },
    policyRef: { id: row.policy_id, name: row.policy_name },
    createdAt: row.created_at,
    review: review
      ? {
          reviewer: review.reviewer,
          finalAction: review.final_action,
          overrodeAI: Boolean(review.overrode_ai),
          notes: review.notes || undefined,
          reviewedAt: review.reviewed_at,
        }
      : undefined,
  };
}
