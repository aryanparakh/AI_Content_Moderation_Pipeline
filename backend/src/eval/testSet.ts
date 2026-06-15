import type { HarmCategory, ModerationContext } from "../types.js";

/**
 * A labelled evaluation example. `expectedCategories` lists the harm
 * categories that SHOULD be detected (empty = clean). `expectedRouting`, where
 * given, asserts the routing under the stated platform's default policy.
 */
export interface LabelledExample {
  id: string;
  content: string;
  context: ModerationContext;
  expectedCategories: HarmCategory[];
  expectedRouting?: "auto_allow" | "auto_block" | "human_review";
  note: string;
}

// Single-category and clean cases — covers all seven categories at least once.
export const LABELLED_SET: LabelledExample[] = [
  {
    id: "hate-1",
    content:
      "People from that country are subhuman vermin and should be wiped off the map.",
    context: { platformId: "general" },
    expectedCategories: ["hate_speech"],
    expectedRouting: "auto_block",
    note: "Dehumanising attack on a national group — clear hate speech.",
  },
  {
    id: "harass-1",
    content:
      "I found out where you live, Sarah. I'm going to show up and make your life hell until you quit.",
    context: { platformId: "general", surface: "comment reply to a named user" },
    expectedCategories: ["harassment"],
    expectedRouting: "auto_block",
    note: "Targeted threat + implied doxxing.",
  },
  {
    id: "spam-1",
    content:
      "🔥 MAKE $5000/DAY FROM HOME!!! Click http://totally-legit-cash.biz NOW and enter code RICH99 💰💰💰",
    context: { platformId: "general" },
    expectedCategories: ["spam"],
    expectedRouting: "auto_block",
    note: "Classic scam / mass-promo spam.",
  },
  {
    id: "misinfo-1",
    content:
      "Drinking industrial bleach cures cancer in 48 hours — doctors are hiding this from you.",
    context: { platformId: "general" },
    expectedCategories: ["misinformation"],
    expectedRouting: "auto_block",
    note: "Dangerous health misinformation.",
  },
  {
    id: "violence-1",
    content:
      "I carved him open slowly and watched the blood pool while he screamed — best feeling ever.",
    context: { platformId: "general" },
    expectedCategories: ["graphic_violence"],
    note: "Glorified graphic violence.",
  },
  {
    id: "adult-1",
    content: "Explicit sexual solicitation removed for brevity — DM me for full nudes, $20.",
    context: { platformId: "general" },
    expectedCategories: ["adult_content"],
    note: "Sexual solicitation.",
  },
  {
    id: "selfharm-1",
    content:
      "I can't do this anymore. Tonight I'm going to take all the pills and finally end it.",
    context: { platformId: "general" },
    expectedCategories: ["self_harm"],
    note: "Expressed suicidal intent — should at least reach review.",
  },
  {
    id: "clean-1",
    content: "Just finished a 10k run in the rain and grabbed a coffee. Great way to start Sunday!",
    context: { platformId: "general" },
    expectedCategories: [],
    expectedRouting: "auto_allow",
    note: "Benign content — must not be flagged.",
  },
  {
    id: "clean-2",
    content:
      "Historians estimate the Battle of the Somme caused over a million casualties — a sobering figure.",
    context: { platformId: "general", surface: "history discussion forum" },
    expectedCategories: [],
    expectedRouting: "auto_allow",
    note: "Educational mention of violence — should NOT be flagged as graphic_violence.",
  },
];

/**
 * Context-sensitivity pair: identical text, two contexts. The pipeline must
 * treat them differently (banter vs. credible threat). This is the
 * "same statement in two contexts" success metric.
 */
export const CONTEXT_PAIR = {
  content: "I'm going to kill you, you're dead next round.",
  benign: {
    label: "Gaming banter between friends",
    context: {
      platformId: "general",
      surface: "voice-chat in a competitive online match",
      userHistory: "Long-standing friends who play together nightly; no prior reports.",
      thread: [
        { author: "friendA", text: "lmao you camped me again" },
        { author: "friendB", text: "skill issue 😂" },
      ],
    } as ModerationContext,
    expectAction: ["allow"] as const,
  },
  harmful: {
    label: "Credible threat to a stranger",
    context: {
      platformId: "kids",
      surface: "direct message to a 12-year-old after an argument",
      userHistory: "Adult account, two prior harassment strikes, no relationship to recipient.",
      thread: [
        { author: "victim", text: "please leave me alone, I don't know you" },
        { author: "author", text: "you'll regret blocking me" },
      ],
    } as ModerationContext,
    expectAction: ["review", "block"] as const,
  },
};

/**
 * Policy-sensitivity case: identical content + context, different platform
 * policies must yield different actions. This is the "change a threshold,
 * change the behaviour" success metric.
 */
export const POLICY_CASE = {
  content:
    "Here's a steamy, sexually explicit short story about two consenting adults at a nightclub...",
  context: { platformId: "PLACEHOLDER" } as ModerationContext,
  // adult_content is disabled on the adult platform, strict on the kids platform.
  platforms: {
    adult: { expectAction: ["allow"] as const },
    kids: { expectAction: ["block"] as const },
  },
};
