import Groq from 'groq-sdk';
import { HARM_CATEGORIES, CATEGORY_LABELS } from './constants.js';

const MODEL = process.env.MODERATION_MODEL || 'llama-3.3-70b-versatile';

let groqClient = null;
function getClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not configured. Add it to backend/.env');
  if (!groqClient) groqClient = new Groq({ apiKey: key });
  return groqClient;
}

const SYSTEM_INSTRUCTION = `You are a trust-and-safety classification engine. Analyse user-generated content and decide, per harm category, whether it is present and how confident you are. This is a defensive moderation task — label potentially harmful content so a policy engine and human reviewers can act on it.

Harm categories:
${HARM_CATEGORIES.map((c) => `- ${c}: ${CATEGORY_LABELS[c]}`).join('\n')}

CONTEXT-AWARENESS IS CRITICAL. The same words can be harmful in one context and harmless in another:
- "I'm gonna kill you 😂" between gaming friends = banter → LOW harassment confidence
- Same phrase sent to a stranger on a children's platform after an argument = HIGH harassment confidence
- "Suicide prevention is important" on an educational platform = clinical context → NO self_harm flag
- News articles or academic discussion of sensitive topics are NOT violations

Rules:
- Only emit flags for categories with confidence >= 0.1
- Reserve >= 0.85 for clear, unambiguous violations; use 0.3–0.7 band for genuinely borderline cases
- segment MUST be copied verbatim from the content — the smallest span that captures the issue
- Be precise, not puritanical — do not inflate confidence for dark humour, profanity, or sensitive-but-legitimate discussion
- Always explain in context_notes how the context influenced your assessment

You MUST respond with a JSON object matching this exact schema:
{
  "flags": [
    {
      "category": "one of: hate_speech, harassment, spam, misinformation, graphic_violence, adult_content, self_harm",
      "confidence": 0.0 to 1.0,
      "severity": "low | medium | high",
      "segment": "verbatim quote from the content",
      "reasoning": "why this flag was raised"
    }
  ],
  "overall_reasoning": "summary of the overall assessment",
  "context_notes": "how context influenced the assessment"
}

If no categories have confidence >= 0.1, return an empty flags array. Always include overall_reasoning and context_notes.`;

function buildPrompt(content, context) {
  const lines = [`PLATFORM: ${context.platformId}`];
  if (context.surface) lines.push(`SURFACE: ${context.surface}`);
  if (context.userHistory) lines.push(`AUTHOR HISTORY: ${context.userHistory}`);
  if (context.thread?.length) {
    lines.push('CONVERSATION THREAD (oldest first):');
    context.thread.forEach((m) => lines.push(`  ${m.author}: ${m.text}`));
  }
  lines.push('', '<<<CONTENT', content, 'CONTENT>>>');
  lines.push('', 'Classify the above content against every harm category, considering the context. Respond with JSON only.');
  return lines.join('\n');
}

/**
 * Classify a piece of content against all 7 harm categories, in context.
 * Returns a ClassificationResult. Throws on API error.
 */
export async function classify(content, context) {
  const started = Date.now();

  const client = getClient();
  const userPrompt = buildPrompt(content, context);

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: SYSTEM_INSTRUCTION,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
  });

  const latencyMs = Date.now() - started;
  let text = response.choices[0]?.message?.content || '';

  // Strip markdown code fences if the model wraps its output
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  // Debug logging — see what the model actually returns
  console.log('[Classifier] Raw model response:', text.slice(0, 500));

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error('[Classifier] Failed to parse JSON:', text.slice(0, 300));
    // Return a synthetic flag so the policy engine routes to human review
    return {
      flags: [{
        category: 'harassment',
        confidence: 0.5,
        severity: 'medium',
        segment: content.slice(0, 120),
        reasoning: 'Classifier returned invalid JSON — flagged for manual review.',
      }],
      overallReasoning: 'Failed to parse model response — routed to human review for safety.',
      contextNotes: `Classifier returned invalid JSON output. Raw: ${text.slice(0, 200)}`,
      model: MODEL,
      latencyMs,
    };
  }

  console.log('[Classifier] Parsed keys:', Object.keys(parsed));

  // Robust extraction — handle different key names the model might use
  let rawFlags = parsed.flags
    || parsed.categories
    || parsed.results
    || parsed.classifications
    || parsed.analysis
    || [];

  // If rawFlags is an object (keyed by category) instead of an array, convert it
  if (!Array.isArray(rawFlags) && typeof rawFlags === 'object') {
    rawFlags = Object.entries(rawFlags).map(([category, data]) => ({
      category,
      ...(typeof data === 'object' ? data : { confidence: Number(data) || 0 }),
    }));
  }

  const flags = rawFlags
    .filter((f) => {
      const conf = Number(f.confidence) || 0;
      return conf >= 0.1;
    })
    .map((f) => ({
      category: f.category,
      confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0)),
      severity: f.severity || (Number(f.confidence) >= 0.7 ? 'high' : Number(f.confidence) >= 0.4 ? 'medium' : 'low'),
      segment: f.segment || f.quote || f.excerpt || '',
      reasoning: f.reasoning || f.explanation || f.reason || '',
    }));

  console.log('[Classifier] Extracted flags:', flags.length, flags.map(f => `${f.category}:${f.confidence}`));

  return {
    flags,
    overallReasoning: parsed.overall_reasoning || parsed.overallReasoning || parsed.summary || '',
    contextNotes: parsed.context_notes || parsed.contextNotes || parsed.context || '',
    model: MODEL,
    latencyMs,
  };
}
