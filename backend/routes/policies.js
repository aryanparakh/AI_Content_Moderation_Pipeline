import { Router } from 'express';
import { dbGet, dbAll, dbRun } from '../db/query.js';
import { HARM_CATEGORIES } from '../moderation/constants.js';
import { seedDefaultPolicies } from '../db/seed.js';
import { getDb, saveDb } from '../db/database.js';

export const policiesRouter = Router();

function getPolicyFull(platformId) {
  const platform = dbGet('SELECT * FROM platforms WHERE id = ?', [platformId]);
  if (!platform) return null;
  const cats = dbAll('SELECT * FROM category_policies WHERE platform_id = ?', [platformId]);
  const rules = dbAll('SELECT * FROM custom_rules WHERE platform_id = ?', [platformId]);

  const categories = {};
  for (const c of cats) {
    categories[c.category] = {
      enabled: Boolean(c.enabled),
      reviewThreshold: c.review_threshold,
      autoActionThreshold: c.auto_action_threshold,
    };
  }
  return {
    id: platform.id,
    name: platform.name,
    description: platform.description,
    categories,
    customRules: rules.map((r) => ({ id: r.id, description: r.description, contains: r.contains, category: r.category, action: r.action })),
  };
}

// GET /api/policies
policiesRouter.get('/policies', (_req, res) => {
  const platforms = dbAll('SELECT id FROM platforms ORDER BY id');
  res.json(platforms.map((p) => getPolicyFull(p.id)).filter(Boolean));
});

// GET /api/policies/:id
policiesRouter.get('/policies/:id', (req, res) => {
  const policy = getPolicyFull(req.params.id);
  if (!policy) return res.status(404).json({ error: 'Policy not found' });
  res.json(policy);
});

// PUT /api/policies/:id
policiesRouter.put('/policies/:id', (req, res) => {
  const platformId = req.params.id;
  const { name, description, categories, customRules } = req.body || {};

  const platform = dbGet('SELECT id FROM platforms WHERE id = ?', [platformId]);
  if (!platform) return res.status(404).json({ error: 'Platform not found' });

  try {
    if (name !== undefined) {
      dbRun('UPDATE platforms SET name = ?, description = ? WHERE id = ?', [name, description ?? '', platformId]);
    }
    if (categories) {
      for (const cat of HARM_CATEGORIES) {
        const c = categories[cat];
        if (c) {
          dbRun(
            'UPDATE category_policies SET enabled = ?, review_threshold = ?, auto_action_threshold = ? WHERE platform_id = ? AND category = ?',
            [c.enabled ? 1 : 0, c.reviewThreshold, c.autoActionThreshold, platformId, cat]
          );
        }
      }
    }
    if (customRules !== undefined) {
      dbRun('DELETE FROM custom_rules WHERE platform_id = ?', [platformId]);
      for (const rule of customRules) {
        const rid = rule.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        dbRun(
          'INSERT INTO custom_rules (id, platform_id, description, contains, category, action) VALUES (?,?,?,?,?,?)',
          [rid, platformId, rule.description || '', rule.contains, rule.category, rule.action]
        );
      }
    }
    res.json(getPolicyFull(platformId));
  } catch (err) {
    console.error('Policy update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/policies/reset
policiesRouter.post('/policies/reset', (_req, res) => {
  const db = getDb();
  db.run('DELETE FROM custom_rules');
  db.run('DELETE FROM category_policies');
  db.run('DELETE FROM platforms');
  seedDefaultPolicies(db);
  saveDb();

  const platforms = dbAll('SELECT id FROM platforms ORDER BY id');
  res.json(platforms.map((p) => getPolicyFull(p.id)).filter(Boolean));
});
