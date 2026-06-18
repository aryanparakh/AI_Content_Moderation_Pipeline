import { HARM_CATEGORIES } from '../moderation/constants.js';

const DEFAULT_PLATFORMS = [
  {
    id: 'general',
    name: 'General Social Platform',
    description: 'Balanced defaults for a broad audience. Clear violations are auto-actioned; borderline cases go to human review.',
    defaultPolicy: { enabled: 1, review_threshold: 0.45, auto_action_threshold: 0.85 },
    overrides: {
      self_harm: { review_threshold: 0.35, auto_action_threshold: 0.9 },
      spam: { review_threshold: 0.55, auto_action_threshold: 0.8 },
    },
    customRules: [],
  },
  {
    id: 'kids',
    name: "Children's Platform",
    description: 'Zero-tolerance surface for under-13 users. Low thresholds; adult content and self-harm blocked on the faintest signal.',
    defaultPolicy: { enabled: 1, review_threshold: 0.2, auto_action_threshold: 0.5 },
    overrides: {
      adult_content: { review_threshold: 0.1, auto_action_threshold: 0.25 },
      self_harm: { review_threshold: 0.1, auto_action_threshold: 0.3 },
      graphic_violence: { review_threshold: 0.15, auto_action_threshold: 0.35 },
      hate_speech: { review_threshold: 0.15, auto_action_threshold: 0.4 },
    },
    customRules: [],
  },
  {
    id: 'adult',
    name: 'Adult / Mature Community',
    description: '18+ community. Mature content permitted; hate, harassment, and self-harm still strictly blocked.',
    defaultPolicy: { enabled: 1, review_threshold: 0.6, auto_action_threshold: 0.9 },
    overrides: {
      adult_content: { enabled: 0, review_threshold: 1.0, auto_action_threshold: 1.0 },
      graphic_violence: { review_threshold: 0.75, auto_action_threshold: 0.95 },
      hate_speech: { review_threshold: 0.5, auto_action_threshold: 0.8 },
      harassment: { review_threshold: 0.5, auto_action_threshold: 0.8 },
      self_harm: { review_threshold: 0.4, auto_action_threshold: 0.85 },
    },
    customRules: [
      { id: 'adult-no-doxxing', description: 'Block posts sharing private addresses', contains: 'home address', category: 'harassment', action: 'block' },
    ],
  },
  {
    id: 'gaming',
    name: 'Gaming Community',
    description: 'Tolerates competitive banter but strictly enforces real threats and hate speech.',
    defaultPolicy: { enabled: 1, review_threshold: 0.5, auto_action_threshold: 0.88 },
    overrides: {
      harassment: { review_threshold: 0.65, auto_action_threshold: 0.9 },
      spam: { review_threshold: 0.5, auto_action_threshold: 0.78 },
    },
    customRules: [],
  },
  {
    id: 'educational',
    name: 'Educational Platform',
    description: 'Academic context — clinical discussion is allowed. Misinformation and self-harm promotion strictly enforced.',
    defaultPolicy: { enabled: 1, review_threshold: 0.5, auto_action_threshold: 0.85 },
    overrides: {
      misinformation: { review_threshold: 0.35, auto_action_threshold: 0.7 },
      self_harm: { review_threshold: 0.45, auto_action_threshold: 0.85 },
      adult_content: { review_threshold: 0.7, auto_action_threshold: 0.9 },
    },
    customRules: [],
  },
];

export function seedDefaultPolicies(db) {
  // Check if already seeded
  const existing = db.exec('SELECT COUNT(*) as n FROM platforms');
  const count = existing[0]?.values[0][0] || 0;
  if (count > 0) return;

  for (const p of DEFAULT_PLATFORMS) {
    db.run('INSERT INTO platforms (id, name, description) VALUES (?, ?, ?)', [p.id, p.name, p.description]);

    for (const cat of HARM_CATEGORIES) {
      const ov = p.overrides[cat] || {};
      const d = p.defaultPolicy;
      const enabled = ov.enabled !== undefined ? ov.enabled : d.enabled;
      const review = ov.review_threshold ?? d.review_threshold;
      const auto = ov.auto_action_threshold ?? d.auto_action_threshold;
      db.run(
        'INSERT OR IGNORE INTO category_policies (platform_id, category, enabled, review_threshold, auto_action_threshold) VALUES (?, ?, ?, ?, ?)',
        [p.id, cat, enabled, review, auto]
      );
    }

    for (const rule of p.customRules) {
      db.run(
        'INSERT OR IGNORE INTO custom_rules (id, platform_id, description, contains, category, action) VALUES (?, ?, ?, ?, ?, ?)',
        [rule.id, p.id, rule.description, rule.contains, rule.category, rule.action]
      );
    }
  }

  console.log('🌱 Seeded 5 default platform policies.');
}
