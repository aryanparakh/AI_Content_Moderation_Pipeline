import {
  CATEGORY_LABELS,
  type Action,
  type ClassificationResult,
  type FlagDecision,
  type ModerationDecision,
  type PlatformPolicy,
} from "../types.js";

const ACTION_RANK: Record<Action, number> = { allow: 0, review: 1, block: 2 };

function moreSevere(a: Action, b: Action): Action {
  return ACTION_RANK[a] >= ACTION_RANK[b] ? a : b;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Apply a platform policy to a raw classification, producing an auditable,
 * aggregated decision. Pure function — no I/O, fully deterministic — which is
 * what makes "change a threshold, change the behaviour" demonstrable and
 * testable without re-calling the model.
 */
export function applyPolicy(
  content: string,
  classification: ClassificationResult,
  policy: PlatformPolicy
): ModerationDecision {
  const perFlag: FlagDecision[] = [];

  // 1. Threshold-based decisions from the model's flags.
  for (const flag of classification.flags) {
    const catPolicy = policy.categories[flag.category];
    const label = CATEGORY_LABELS[flag.category];

    if (!catPolicy || !catPolicy.enabled) {
      perFlag.push({
        ...flag,
        action: "allow",
        explanation: `${label} is disabled for "${policy.name}" — flag ignored.`,
      });
      continue;
    }

    let action: Action;
    let explanation: string;
    if (flag.confidence >= catPolicy.autoActionThreshold) {
      action = "block";
      explanation = `${label} confidence ${pct(flag.confidence)} ≥ auto-action threshold ${pct(
        catPolicy.autoActionThreshold
      )} → blocked automatically.`;
    } else if (flag.confidence >= catPolicy.reviewThreshold) {
      action = "review";
      explanation = `${label} confidence ${pct(flag.confidence)} is in the review band [${pct(
        catPolicy.reviewThreshold
      )}, ${pct(catPolicy.autoActionThreshold)}) → sent to human review.`;
    } else {
      action = "allow";
      explanation = `${label} confidence ${pct(flag.confidence)} < review threshold ${pct(
        catPolicy.reviewThreshold
      )} → below the bar, allowed.`;
    }

    perFlag.push({ ...flag, action, explanation });
  }

  // 2. Custom keyword rules (forced overrides, independent of model confidence).
  const lower = content.toLowerCase();
  for (const rule of policy.customRules) {
    if (!rule.contains) continue;
    if (!lower.includes(rule.contains.toLowerCase())) continue;

    const label = CATEGORY_LABELS[rule.category];
    const explanation = `Custom rule "${rule.description}" matched phrase “${rule.contains}” → forced ${rule.action}.`;

    // If the model already flagged this category, upgrade that flag's action;
    // otherwise synthesise a flag so the rule is visible in the audit trail.
    const existing = perFlag.find((f) => f.category === rule.category);
    if (existing) {
      existing.action = moreSevere(existing.action, rule.action);
      existing.explanation += ` ${explanation}`;
    } else {
      perFlag.push({
        category: rule.category,
        confidence: 1,
        severity: "high",
        segment: rule.contains,
        reasoning: `Matched custom rule: ${rule.description}.`,
        action: rule.action,
        explanation,
      });
    }
  }

  // 3. Aggregate to a single action + routing.
  let aggregate: Action = "allow";
  for (const f of perFlag) aggregate = moreSevere(aggregate, f.action);

  // The primary flag is the one driving the aggregate action (ties broken by
  // confidence) — this is what the UI highlights and reviewers see first.
  const primaryFlag =
    perFlag
      .filter((f) => f.action === aggregate && aggregate !== "allow")
      .sort((a, b) => b.confidence - a.confidence)[0] ?? null;

  const routing =
    aggregate === "block" ? "auto_block" : aggregate === "review" ? "human_review" : "auto_allow";

  let summary: string;
  if (aggregate === "allow") {
    summary = perFlag.length
      ? "No flag crossed an actionable threshold under this policy — content allowed."
      : "No harm detected — content allowed.";
  } else if (aggregate === "block") {
    summary = `Auto-blocked: ${primaryFlag ? CATEGORY_LABELS[primaryFlag.category] : "policy violation"} (${
      primaryFlag ? pct(primaryFlag.confidence) : "high"
    } confidence).`;
  } else {
    summary = `Queued for human review: ${
      primaryFlag ? CATEGORY_LABELS[primaryFlag.category] : "borderline content"
    } needs a human call.`;
  }

  return { action: aggregate, routing, perFlag, primaryFlag, summary };
}
