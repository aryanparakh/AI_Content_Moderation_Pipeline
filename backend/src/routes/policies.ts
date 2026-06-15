import { Router } from "express";
import { z } from "zod";
import { store } from "../store/store.js";
import { HARM_CATEGORIES, CATEGORY_LABELS, type PlatformPolicy } from "../types.js";

export const policiesRouter = Router();

const CategoryPolicySchema = z.object({
  enabled: z.boolean(),
  autoActionThreshold: z.number().min(0).max(1),
  reviewThreshold: z.number().min(0).max(1),
});

const CustomRuleSchema = z.object({
  id: z.string(),
  description: z.string(),
  contains: z.string(),
  category: z.enum(HARM_CATEGORIES),
  action: z.enum(["block", "review", "allow"]),
});

const PolicySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  categories: z.record(z.enum(HARM_CATEGORIES), CategoryPolicySchema),
  customRules: z.array(CustomRuleSchema),
});

/** GET /api/categories — category ids + labels (for building the UI). */
policiesRouter.get("/categories", (_req, res) => {
  res.json(HARM_CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id] })));
});

/** GET /api/policies — all platform policies. */
policiesRouter.get("/policies", (_req, res) => {
  res.json(store.listPolicies());
});

/** GET /api/policies/:id — one policy. */
policiesRouter.get("/policies/:id", (req, res) => {
  const policy = store.getPolicy(req.params.id);
  if (!policy) return res.status(404).json({ error: "not found" });
  res.json(policy);
});

/** PUT /api/policies/:id — create or replace a platform policy. */
policiesRouter.put("/policies/:id", (req, res) => {
  const parsed = PolicySchema.safeParse({ ...req.body, id: req.params.id });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Ensure every category has an entry (fill missing with a permissive default).
  for (const cat of HARM_CATEGORIES) {
    if (!parsed.data.categories[cat]) {
      parsed.data.categories[cat] = {
        enabled: true,
        autoActionThreshold: 0.85,
        reviewThreshold: 0.45,
      };
    }
  }
  // All category keys are guaranteed present after the fill loop above.
  const saved = store.upsertPolicy(parsed.data as PlatformPolicy);
  res.json(saved);
});

/** POST /api/policies/reset — restore the shipped default policies. */
policiesRouter.post("/policies/reset", (_req, res) => {
  store.resetPolicies();
  res.json(store.listPolicies());
});
