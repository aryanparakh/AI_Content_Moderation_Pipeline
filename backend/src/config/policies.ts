import { HARM_CATEGORIES, type HarmCategory, type PlatformPolicy, type CategoryPolicy } from "../types.js";

/** Build a category-policy map from a partial override, defaulting the rest. */
function makeCategories(
  defaults: CategoryPolicy,
  overrides: Partial<Record<HarmCategory, Partial<CategoryPolicy>>> = {}
): Record<HarmCategory, CategoryPolicy> {
  const out = {} as Record<HarmCategory, CategoryPolicy>;
  for (const cat of HARM_CATEGORIES) {
    out[cat] = { ...defaults, ...(overrides[cat] ?? {}) };
  }
  return out;
}

/**
 * Default policies shipped with the system. They are deep-cloned into the
 * mutable store at startup, so editing one platform never affects another.
 *
 * The contrast between "kids" and "adult" is the demonstration that the same
 * pipeline produces different decisions purely from policy configuration.
 */
export const DEFAULT_POLICIES: PlatformPolicy[] = [
  {
    id: "general",
    name: "General Social Platform",
    description:
      "Balanced defaults for a broad audience. Clear violations are actioned automatically; borderline cases go to human review.",
    categories: makeCategories(
      { enabled: true, autoActionThreshold: 0.85, reviewThreshold: 0.45 },
      {
        // Self-harm is sensitive: review earlier, act only when very confident.
        self_harm: { autoActionThreshold: 0.9, reviewThreshold: 0.35 },
        spam: { autoActionThreshold: 0.8, reviewThreshold: 0.55 },
      }
    ),
    customRules: [],
  },
  {
    id: "kids",
    name: "Children's Platform (strict)",
    description:
      "Zero-tolerance surface for under-13 users. Low thresholds across the board; adult content and self-harm are blocked on the faintest signal.",
    categories: makeCategories(
      { enabled: true, autoActionThreshold: 0.5, reviewThreshold: 0.2 },
      {
        adult_content: { autoActionThreshold: 0.25, reviewThreshold: 0.1 },
        self_harm: { autoActionThreshold: 0.3, reviewThreshold: 0.1 },
        graphic_violence: { autoActionThreshold: 0.35, reviewThreshold: 0.15 },
        hate_speech: { autoActionThreshold: 0.4, reviewThreshold: 0.15 },
      }
    ),
    customRules: [],
  },
  {
    id: "adult",
    name: "Adult / Mature Community",
    description:
      "18+ community that tolerates strong language and mature themes. Adult content is permitted; the platform still blocks hate, harassment and self-harm promotion.",
    categories: makeCategories(
      { enabled: true, autoActionThreshold: 0.9, reviewThreshold: 0.6 },
      {
        // Mature themes are allowed here.
        adult_content: { enabled: false, autoActionThreshold: 1.0, reviewThreshold: 1.0 },
        graphic_violence: { autoActionThreshold: 0.95, reviewThreshold: 0.75 },
        // Still protect against targeted hate / harassment and self-harm.
        hate_speech: { autoActionThreshold: 0.8, reviewThreshold: 0.5 },
        harassment: { autoActionThreshold: 0.8, reviewThreshold: 0.5 },
        self_harm: { autoActionThreshold: 0.85, reviewThreshold: 0.4 },
      }
    ),
    customRules: [
      {
        id: "adult-no-doxxing",
        description: "Block posts that share private addresses even in this lax community.",
        contains: "home address",
        category: "harassment",
        action: "block",
      },
    ],
  },
];
