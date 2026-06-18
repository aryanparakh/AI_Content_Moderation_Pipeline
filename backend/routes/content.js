import { Router } from 'express';
import { dbGet, dbAll, dbRun } from '../db/query.js';
import { buildRecord } from '../db/records.js';
import { classify } from '../moderation/classifier.js';
import { getPolicy, applyPolicy } from '../moderation/policyEngine.js';
import { HARM_CATEGORIES, CATEGORY_LABELS } from '../moderation/constants.js';

export const contentRouter = Router();

// GET /api/categories
contentRouter.get('/categories', (_req, res) => {
  res.json(HARM_CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id] })));
});

// POST /api/moderate
contentRouter.post('/moderate', async (req, res) => {
  const { content, context } = req.body || {};
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });
  if (!context?.platformId) return res.status(400).json({ error: 'context.platformId is required' });

  const policy = getPolicy(context.platformId);
  if (!policy) return res.status(400).json({ error: `Unknown platform "${context.platformId}"` });

  try {
    const classification = await classify(content, context);
    const decision = applyPolicy(content, classification, policy);
    const id = `mod_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    dbRun(
      `INSERT INTO content_records
        (id, content, platform_id, surface, user_history, thread,
         flags, overall_reasoning, context_notes, model_used, latency_ms,
         action, routing, per_flag, primary_flag, decision_summary,
         policy_id, policy_name, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, content, context.platformId,
        context.surface || null, context.userHistory || null,
        JSON.stringify(context.thread || []),
        JSON.stringify(classification.flags),
        classification.overallReasoning, classification.contextNotes,
        classification.model, classification.latencyMs,
        decision.action, decision.routing,
        JSON.stringify(decision.perFlag),
        decision.primaryFlag ? JSON.stringify(decision.primaryFlag) : null,
        decision.summary, policy.id, policy.name, now,
      ]
    );

    res.json(buildRecord(dbGet('SELECT * FROM content_records WHERE id = ?', [id])));
  } catch (err) {
    console.error('Moderation error:', err.message);
    const status = /api key|groq_api_key|not configured/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/records
contentRouter.get('/records', (_req, res) => {
  const rows = dbAll('SELECT * FROM content_records ORDER BY created_at DESC LIMIT 200');
  res.json(rows.map(buildRecord));
});

// GET /api/records/:id
contentRouter.get('/records/:id', (req, res) => {
  const row = dbGet('SELECT * FROM content_records WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Record not found' });
  res.json(buildRecord(row));
});
