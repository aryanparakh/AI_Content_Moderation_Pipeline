import { classify } from "./classifier.js";
import { applyPolicy } from "./policyEngine.js";
import { store } from "../store/store.js";
import type { ModerationContext, ModerationRecord } from "../types.js";

/**
 * End-to-end moderation of one piece of content:
 *   classify (LLM, context-aware) → apply platform policy → route → persist.
 *
 * The record is always stored so it is auditable and (when routed to review)
 * appears in the human queue.
 */
export async function moderate(
  content: string,
  context: ModerationContext
): Promise<ModerationRecord> {
  const policy = store.getPolicy(context.platformId);
  if (!policy) {
    throw new Error(`Unknown platform "${context.platformId}". Configure a policy first.`);
  }

  const classification = await classify(content, context);
  const decision = applyPolicy(content, classification, policy);

  const record: ModerationRecord = {
    id: store.nextId("mod"),
    content,
    context,
    classification,
    decision,
    policyRef: { id: policy.id, name: policy.name },
    createdAt: new Date().toISOString(),
  };

  return store.saveRecord(record);
}
