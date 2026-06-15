import { Router } from "express";
import { z } from "zod";
import { moderate } from "../moderation/pipeline.js";
import { applyPolicy } from "../moderation/policyEngine.js";
import { store } from "../store/store.js";

export const moderateRouter = Router();

const ContextSchema = z.object({
  platformId: z.string().min(1),
  surface: z.string().optional(),
  userHistory: z.string().optional(),
  thread: z
    .array(z.object({ author: z.string(), text: z.string() }))
    .optional(),
});

const ModerateSchema = z.object({
  content: z.string().min(1, "content is required"),
  context: ContextSchema,
});

/** POST /api/moderate — run a piece of content through the full pipeline. */
moderateRouter.post("/moderate", async (req, res) => {
  const parsed = ModerateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const record = await moderate(parsed.data.content, parsed.data.context);
    res.json(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Moderation failed";
    // Auth / config errors get a 400; unexpected failures a 500.
    const status = /unknown platform|api key|authentication/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

const PreviewSchema = ModerateSchema.extend({
  // Re-run policy against an *existing* record's classification, without
  // calling the model again — used to preview the effect of a threshold change.
  recordId: z.string().optional(),
});

/**
 * POST /api/preview-policy — apply a (possibly draft) policy to an already
 * classified record, so the UI can show "what would change" instantly and for
 * free. If `recordId` is given, reuse that record's classification.
 */
moderateRouter.post("/preview-policy", (req, res) => {
  const schema = z.object({
    recordId: z.string(),
    platformId: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const record = store.getRecord(parsed.data.recordId);
  if (!record) return res.status(404).json({ error: "record not found" });
  const policy = store.getPolicy(parsed.data.platformId);
  if (!policy) return res.status(404).json({ error: "policy not found" });

  const decision = applyPolicy(record.content, record.classification, policy);
  res.json({ decision, policyRef: { id: policy.id, name: policy.name } });
});
