import { Router } from "express";
import { z } from "zod";
import { store } from "../store/store.js";

export const queueRouter = Router();

/** GET /api/queue — items pending human review (full context + AI decision). */
queueRouter.get("/queue", (_req, res) => {
  res.json(store.listQueue());
});

/** GET /api/records — full audit log of everything processed. */
queueRouter.get("/records", (_req, res) => {
  res.json(store.listRecords());
});

/** GET /api/records/:id — a single record. */
queueRouter.get("/records/:id", (req, res) => {
  const record = store.getRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "not found" });
  res.json(record);
});

const ReviewSchema = z.object({
  reviewer: z.string().min(1),
  finalAction: z.enum(["allow", "review", "block"]),
  notes: z.string().optional(),
});

/**
 * POST /api/queue/:id/review — a human reviewer's final verdict. Records the
 * outcome, flags whether it overrode the AI, and stores it as feedback.
 */
queueRouter.post("/queue/:id/review", (req, res) => {
  const parsed = ReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const record = store.getRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "record not found" });
  if (record.review) return res.status(409).json({ error: "already reviewed" });

  const overrodeAI = parsed.data.finalAction !== record.decision.action;
  const updated = store.applyReview(req.params.id, {
    reviewer: parsed.data.reviewer,
    finalAction: parsed.data.finalAction,
    overrodeAI,
    notes: parsed.data.notes,
    reviewedAt: new Date().toISOString(),
  });
  res.json(updated);
});

/** GET /api/feedback — reviewer decisions captured as labelled examples. */
queueRouter.get("/feedback", (_req, res) => {
  res.json(store.listFeedback());
});

/** GET /api/stats — dashboard counters. */
queueRouter.get("/stats", (_req, res) => {
  res.json(store.stats());
});
