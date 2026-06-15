import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// The SDK's zodOutputFormat helper targets the zod v4 API (re-exported by zod 3.25+).
import { z } from "zod/v4";
import {
  HARM_CATEGORIES,
  CATEGORY_LABELS,
  type ClassificationResult,
  type ModerationContext,
} from "../types.js";

// ---------------------------------------------------------------------------
// LLM-backed multi-category classifier.
//
// Uses the Anthropic Messages API with *structured outputs* so the model is
// forced to return a schema-valid object — no brittle JSON parsing. Adaptive
// thinking is enabled by default because correct context-aware judgement
// (same words, different meaning depending on platform / thread) benefits
// materially from reasoning.
// ---------------------------------------------------------------------------

const MODEL = process.env.MODERATION_MODEL || "claude-opus-4-8";
const USE_THINKING = (process.env.MODERATION_THINKING ?? "true") !== "false";

// Lazily construct the client so the module can be imported without a key
// (e.g. for type checks). The key is read from ANTHROPIC_API_KEY.
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

// --- Structured-output schema (mirrors ClassificationResult) ---------------

const FlagSchema = z.object({
  category: z.enum(HARM_CATEGORIES),
  confidence: z
    .number()
    .describe("Probability 0.0-1.0 that this harm category is present in the content."),
  severity: z.enum(["low", "medium", "high"]),
  segment: z
    .string()
    .describe("The exact verbatim span of the content that triggered this flag."),
  reasoning: z.string().describe("Why this span is flagged, in one or two sentences."),
});

const ClassificationSchema = z.object({
  flags: z
    .array(FlagSchema)
    .describe("One entry per harm category detected with confidence >= 0.1. Empty if content is clean."),
  overall_reasoning: z.string().describe("One-line overall read of the content."),
  context_notes: z
    .string()
    .describe("How the supplied platform/history/thread context changed the assessment, if at all."),
});

const SYSTEM_PROMPT = `You are a trust-and-safety classification engine. You analyse user-generated content and decide, per harm category, whether it is present and how confident you are. This is a defensive moderation task: your job is to LABEL potentially harmful content so a policy engine and human reviewers can act on it — never to produce harmful content yourself.

Harm categories (use these exact ids):
${HARM_CATEGORIES.map((c) => `- ${c}: ${CATEGORY_LABELS[c]}`).join("\n")}

Definitions:
- hate_speech: attacks or dehumanises people based on a protected attribute (race, religion, ethnicity, gender, sexual orientation, disability, etc.).
- harassment: targeted bullying, threats, intimidation, or doxxing aimed at an individual.
- spam: unsolicited promotion, scams, mass advertising, or link-farming.
- misinformation: demonstrably false or misleading factual claims, especially health/elections/safety.
- graphic_violence: vivid depictions or glorification of gore, killing, or physical harm.
- adult_content: sexually explicit material or solicitation.
- self_harm: content that encourages, instructs, or expresses intent toward suicide or self-injury.

CONTEXT-AWARENESS IS CRITICAL. The same words can be harmful in one context and harmless in another. Weigh the platform, the author's history, and the conversation thread:
- "I'm gonna kill you" between friends after losing a game (competitive-gaming surface) is banter, not a threat — low/no harassment confidence.
- The same phrase directed at a stranger after an argument, on a platform for minors, is a credible threat — high harassment confidence.
- Clinical, educational, or news discussion of a harmful topic is usually NOT a violation even though the topic is sensitive.
- Always explain in context_notes how the context moved your assessment.

Rules:
- Emit a flag ONLY for categories you actually detect (confidence >= 0.1). If the content is clean, return an empty flags array.
- confidence is your calibrated probability (0.0-1.0) that the category genuinely applies in this context. Reserve >= 0.85 for clear, unambiguous violations; use the 0.3-0.7 band for genuinely borderline cases.
- segment MUST be copied verbatim from the content (the smallest span that captures the issue) so it can be highlighted to reviewers.
- Be precise, not puritanical. Do not inflate confidence for mere profanity, dark humour, or sensitive-but-legitimate discussion.`;

function buildUserMessage(content: string, context: ModerationContext): string {
  const parts: string[] = [];
  parts.push(`PLATFORM: ${context.platformId}`);
  if (context.surface) parts.push(`SURFACE: ${context.surface}`);
  if (context.userHistory) parts.push(`AUTHOR HISTORY: ${context.userHistory}`);
  if (context.thread && context.thread.length) {
    parts.push("CONVERSATION THREAD (oldest first):");
    for (const m of context.thread) parts.push(`  ${m.author}: ${m.text}`);
  }
  parts.push("");
  parts.push("CONTENT TO CLASSIFY (verbatim, between the markers):");
  parts.push("<<<CONTENT");
  parts.push(content);
  parts.push("CONTENT>>>");
  parts.push("");
  parts.push(
    "Classify the content above against every harm category, taking the context into account. Return schema-valid JSON only."
  );
  return parts.join("\n");
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Classify a piece of content against all harm categories, in context.
 * Throws if the API call fails; callers decide how to surface that.
 */
export async function classify(
  content: string,
  context: ModerationContext
): Promise<ClassificationResult> {
  const started = Date.now();

  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    ...(USE_THINKING ? { thinking: { type: "adaptive" as const } } : {}),
    system: SYSTEM_PROMPT,
    output_config: { format: zodOutputFormat(ClassificationSchema) },
    messages: [{ role: "user", content: buildUserMessage(content, context) }],
  });

  const latencyMs = Date.now() - started;

  // A safety refusal (rare for this defensive framing) leaves parsed_output null.
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    return {
      flags: [],
      overallReasoning:
        "The model declined to classify this content automatically; route to human review.",
      contextNotes:
        response.stop_reason === "refusal"
          ? "Classifier returned a safety refusal — treat as needs-review rather than clean."
          : "Classifier returned no structured output.",
      model: response.model || MODEL,
      latencyMs,
    };
  }

  const parsed = response.parsed_output;

  return {
    flags: parsed.flags.map((f) => ({
      category: f.category,
      confidence: clamp01(f.confidence),
      severity: f.severity,
      segment: f.segment,
      reasoning: f.reasoning,
    })),
    overallReasoning: parsed.overall_reasoning,
    contextNotes: parsed.context_notes,
    model: response.model || MODEL,
    latencyMs,
  };
}
