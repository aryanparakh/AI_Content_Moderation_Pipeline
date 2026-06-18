import { Router } from 'express';
import { dbGet, dbAll, dbRun } from '../db/query.js';
import { buildRecord } from '../db/records.js';

export const queueRouter = Router();

// GET /api/queue
queueRouter.get('/queue', (_req, res) => {
  const rows = dbAll(`
    SELECT cr.* FROM content_records cr
    LEFT JOIN review_outcomes ro ON cr.id = ro.record_id
    WHERE cr.routing = 'human_review' AND ro.id IS NULL
    ORDER BY cr.created_at DESC
  `);
  res.json(rows.map(buildRecord));
});

// POST /api/queue/:id/review
queueRouter.post('/queue/:id/review', (req, res) => {
  const { reviewer, finalAction, notes } = req.body || {};
  if (!reviewer?.trim()) return res.status(400).json({ error: 'reviewer is required' });
  if (!['allow', 'review', 'block'].includes(finalAction)) {
    return res.status(400).json({ error: 'finalAction must be allow | review | block' });
  }

  const record = dbGet('SELECT * FROM content_records WHERE id = ?', [req.params.id]);
  if (!record) return res.status(404).json({ error: 'Record not found' });

  const existing = dbGet('SELECT id FROM review_outcomes WHERE record_id = ?', [req.params.id]);
  if (existing) return res.status(409).json({ error: 'Already reviewed' });

  const overrodeAI = finalAction !== record.action ? 1 : 0;
  dbRun(
    'INSERT INTO review_outcomes (record_id, reviewer, final_action, overrode_ai, notes, reviewed_at) VALUES (?,?,?,?,?,?)',
    [req.params.id, reviewer.trim(), finalAction, overrodeAI, notes || null, new Date().toISOString()]
  );

  res.json(buildRecord(dbGet('SELECT * FROM content_records WHERE id = ?', [req.params.id])));
});

// GET /api/feedback
queueRouter.get('/feedback', (_req, res) => {
  const rows = dbAll(`
    SELECT ro.record_id, ro.final_action, ro.notes, ro.reviewed_at,
           cr.content, cr.platform_id, cr.action as ai_action
    FROM review_outcomes ro
    JOIN content_records cr ON ro.record_id = cr.id
    WHERE ro.overrode_ai = 1
    ORDER BY ro.reviewed_at DESC
  `);
  res.json(rows.map((r) => ({
    recordId: r.record_id,
    content: r.content,
    platformId: r.platform_id,
    aiAction: r.ai_action,
    humanAction: r.final_action,
    notes: r.notes,
    reviewedAt: r.reviewed_at,
  })));
});

// GET /api/stats
queueRouter.get('/stats', (_req, res) => {
  const total = dbGet('SELECT COUNT(*) as n FROM content_records')?.n || 0;
  const autoAllowed = dbGet("SELECT COUNT(*) as n FROM content_records WHERE routing='auto_allow'")?.n || 0;
  const autoBlocked = dbGet("SELECT COUNT(*) as n FROM content_records WHERE routing='auto_block'")?.n || 0;
  const pendingReview = dbGet(`
    SELECT COUNT(*) as n FROM content_records cr
    LEFT JOIN review_outcomes ro ON cr.id = ro.record_id
    WHERE cr.routing = 'human_review' AND ro.id IS NULL
  `)?.n || 0;
  const reviewed = dbGet('SELECT COUNT(*) as n FROM review_outcomes')?.n || 0;
  const overrides = dbGet('SELECT COUNT(*) as n FROM review_outcomes WHERE overrode_ai = 1')?.n || 0;
  const agreement = reviewed === 0 ? null : Math.round(((reviewed - overrides) / reviewed) * 100) / 100;

  res.json({ totalProcessed: total, autoAllowed, autoBlocked, pendingReview, reviewed, humanOverrides: overrides, aiHumanAgreement: agreement });
});
