import { dbGet, dbAll } from '../db/query.js';
import { CATEGORY_LABELS } from './constants.js';

const ACTION_RANK = { allow: 0, review: 1, block: 2 };
function moreSevere(a, b) { return ACTION_RANK[a] >= ACTION_RANK[b] ? a : b; }
function pct(n) { return `${Math.round(n * 100)}%`; }

/** Load a platform's full policy (category thresholds + custom rules) from SQLite. */
export function getPolicy(platformId) {
  const platform = dbGet('SELECT * FROM platforms WHERE id = ?', [platformId]);
  if (!platform) return null;
  const categories = dbAll('SELECT * FROM category_policies WHERE platform_id = ?', [platformId]);
  const customRules = dbAll('SELECT * FROM custom_rules WHERE platform_id = ?', [platformId]);
  return { ...platform, categories, customRules };
}

/**
 * Pure, deterministic policy application — no I/O.
 * Takes a classification result + policy, returns a routing decision.
 */
export function applyPolicy(content, classification, policy) {
  const catMap = {};
  for (const c of policy.categories) catMap[c.category] = c;

  const perFlag = [];

  // 1. Threshold-based decisions from model flags
  for (const flag of classification.flags) {
    const cat = catMap[flag.category];
    const label = CATEGORY_LABELS[flag.category] || flag.category;

    if (!cat || !cat.enabled) {
      perFlag.push({ ...flag, action: 'allow', explanation: `${label} is disabled for this platform — flag ignored.` });
      continue;
    }

    let action, explanation;
    if (flag.confidence >= cat.auto_action_threshold) {
      action = 'block';
      explanation = `${label} confidence ${pct(flag.confidence)} ≥ auto-block threshold ${pct(cat.auto_action_threshold)} → automatically blocked.`;
    } else if (flag.confidence >= cat.review_threshold) {
      action = 'review';
      explanation = `${label} confidence ${pct(flag.confidence)} is in review band [${pct(cat.review_threshold)}, ${pct(cat.auto_action_threshold)}) → sent to human review.`;
    } else {
      action = 'allow';
      explanation = `${label} confidence ${pct(flag.confidence)} < review threshold ${pct(cat.review_threshold)} → below the bar, allowed.`;
    }
    perFlag.push({ ...flag, action, explanation });
  }

  // 2. Custom keyword rule overrides
  const lower = content.toLowerCase();
  for (const rule of policy.customRules) {
    if (!rule.contains) continue;
    if (!lower.includes(rule.contains.toLowerCase())) continue;
    const label = CATEGORY_LABELS[rule.category] || rule.category;
    const explanation = `Custom rule "${rule.description}" matched phrase "${rule.contains}" → forced ${rule.action}.`;
    const existing = perFlag.find((f) => f.category === rule.category);
    if (existing) {
      existing.action = moreSevere(existing.action, rule.action);
      existing.explanation += ' ' + explanation;
    } else {
      perFlag.push({ category: rule.category, confidence: 1, severity: 'high', segment: rule.contains, reasoning: `Matched custom rule: ${rule.description}.`, action: rule.action, explanation });
    }
  }

  // 3. Aggregate to a single action
  let aggregate = 'allow';
  for (const f of perFlag) aggregate = moreSevere(aggregate, f.action);

  const primaryFlag = perFlag
    .filter((f) => f.action === aggregate && aggregate !== 'allow')
    .sort((a, b) => b.confidence - a.confidence)[0] ?? null;

  const routing = aggregate === 'block' ? 'auto_block' : aggregate === 'review' ? 'human_review' : 'auto_allow';

  let summary;
  if (aggregate === 'allow') {
    summary = perFlag.length ? 'No flag crossed an actionable threshold under this policy — content allowed.' : 'No harm detected — content allowed.';
  } else if (aggregate === 'block') {
    summary = `Auto-blocked: ${primaryFlag ? CATEGORY_LABELS[primaryFlag.category] : 'policy violation'} (${primaryFlag ? pct(primaryFlag.confidence) : 'high'} confidence).`;
  } else {
    summary = `Queued for human review: ${primaryFlag ? CATEGORY_LABELS[primaryFlag.category] : 'borderline content'} needs a human call.`;
  }

  return { action: aggregate, routing, perFlag, primaryFlag, summary };
}
