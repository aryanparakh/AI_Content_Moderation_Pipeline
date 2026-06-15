import "dotenv/config";
import { classify } from "../moderation/classifier.js";
import { applyPolicy } from "../moderation/policyEngine.js";
import { store } from "../store/store.js";
import { CATEGORY_LABELS, type HarmCategory } from "../types.js";
import { LABELLED_SET, CONTEXT_PAIR, POLICY_CASE } from "./testSet.js";

// ---------------------------------------------------------------------------
// Offline-ish evaluation harness. Runs the labelled set through the REAL
// pipeline (classifier + policy engine) and checks each success metric.
//   npm run evaluate
// Requires ANTHROPIC_API_KEY.
// ---------------------------------------------------------------------------

const DETECT_THRESHOLD = 0.5; // confidence at/above which we count a category "detected"

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function detectedCategories(flags: { category: HarmCategory; confidence: number }[]): HarmCategory[] {
  return flags.filter((f) => f.confidence >= DETECT_THRESHOLD).map((f) => f.category);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

async function metric1_classification() {
  console.log("\n=== Metric 1: Multi-category classification on the labelled set ===");
  for (const ex of LABELLED_SET) {
    const policy = store.getPolicy(ex.context.platformId)!;
    const cls = await classify(ex.content, ex.context);
    const decision = applyPolicy(ex.content, cls, policy);
    const detected = detectedCategories(cls.flags);

    if (ex.expectedCategories.length === 0) {
      // Clean item: nothing should be detected above threshold.
      check(
        `[${ex.id}] clean content not flagged`,
        detected.length === 0,
        detected.length ? `unexpectedly detected ${detected.join(", ")}` : "no flags"
      );
    } else {
      const missing = ex.expectedCategories.filter((c) => !detected.includes(c));
      check(
        `[${ex.id}] detects ${ex.expectedCategories.map((c) => CATEGORY_LABELS[c]).join(", ")}`,
        missing.length === 0,
        missing.length ? `missed ${missing.join(", ")}` : `detected ${detected.join(", ")}`
      );

      // Metric 4 (explainability): every flag points at a verbatim segment.
      for (const f of cls.flags.filter((fl) => ex.expectedCategories.includes(fl.category))) {
        const inContent = f.segment.length > 0 && normalize(ex.content).includes(normalize(f.segment));
        check(
          `[${ex.id}] ${CATEGORY_LABELS[f.category]} cites a verbatim offending segment`,
          inContent,
          inContent ? `“${f.segment.slice(0, 60)}”` : `segment "${f.segment.slice(0, 40)}" not found in content`
        );
      }
    }

    // Metric 3 (routing) where an expectation is declared.
    if (ex.expectedRouting) {
      check(
        `[${ex.id}] routes to ${ex.expectedRouting}`,
        decision.routing === ex.expectedRouting,
        `got ${decision.routing}`
      );
    }
  }
}

async function metric2_context() {
  console.log("\n=== Metric 2: Same statement, two contexts ===");
  console.log(`  Statement: "${CONTEXT_PAIR.content}"`);

  const benignCls = await classify(CONTEXT_PAIR.content, CONTEXT_PAIR.benign.context);
  const benignDecision = applyPolicy(
    CONTEXT_PAIR.content,
    benignCls,
    store.getPolicy(CONTEXT_PAIR.benign.context.platformId)!
  );

  const harmfulCls = await classify(CONTEXT_PAIR.content, CONTEXT_PAIR.harmful.context);
  const harmfulDecision = applyPolicy(
    CONTEXT_PAIR.content,
    harmfulCls,
    store.getPolicy(CONTEXT_PAIR.harmful.context.platformId)!
  );

  console.log(`  • ${CONTEXT_PAIR.benign.label}: ${benignDecision.action} (${benignDecision.routing})`);
  console.log(`    context note: ${benignCls.contextNotes}`);
  console.log(`  • ${CONTEXT_PAIR.harmful.label}: ${harmfulDecision.action} (${harmfulDecision.routing})`);
  console.log(`    context note: ${harmfulCls.contextNotes}`);

  check(
    "benign context → allowed",
    (CONTEXT_PAIR.benign.expectAction as readonly string[]).includes(benignDecision.action)
  );
  check(
    "harmful context → review or block",
    (CONTEXT_PAIR.harmful.expectAction as readonly string[]).includes(harmfulDecision.action)
  );
  check(
    "the two contexts produce DIFFERENT actions",
    benignDecision.action !== harmfulDecision.action,
    `${benignDecision.action} vs ${harmfulDecision.action}`
  );
}

async function metric5_policy() {
  console.log("\n=== Metric 5: Same content, different policy → different behaviour ===");
  // Classify once with a neutral context, then apply each platform policy.
  const cls = await classify(POLICY_CASE.content, { platformId: "general" });
  const detected = detectedCategories(cls.flags);
  console.log(`  Detected: ${detected.length ? detected.join(", ") : "(none above threshold)"}`);

  const adult = applyPolicy(POLICY_CASE.content, cls, store.getPolicy("adult")!);
  const kids = applyPolicy(POLICY_CASE.content, cls, store.getPolicy("kids")!);

  console.log(`  • Adult / Mature Community: ${adult.action} (${adult.routing}) — ${adult.summary}`);
  console.log(`  • Children's Platform: ${kids.action} (${kids.routing}) — ${kids.summary}`);

  check(
    "adult platform allows it",
    (POLICY_CASE.platforms.adult.expectAction as readonly string[]).includes(adult.action)
  );
  check(
    "children's platform blocks it",
    (POLICY_CASE.platforms.kids.expectAction as readonly string[]).includes(kids.action)
  );
  check("the two policies disagree on the same content", adult.action !== kids.action,
    `${adult.action} vs ${kids.action}`);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Copy backend/.env.example to backend/.env and add your key.");
    process.exit(2);
  }
  console.log(`Evaluating with model: ${process.env.MODERATION_MODEL || "claude-opus-4-8"}`);

  await metric1_classification();
  await metric2_context();
  await metric5_policy();

  console.log(`\n=== Summary: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Evaluation crashed:", err);
  process.exit(3);
});
