import { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';

const CATEGORIES = [
  { id: 'hate_speech', label: 'Hate Speech' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'spam', label: 'Spam' },
  { id: 'misinformation', label: 'Misinformation' },
  { id: 'graphic_violence', label: 'Graphic Violence' },
  { id: 'adult_content', label: 'Adult Content' },
  { id: 'self_harm', label: 'Self-Harm' },
];

function Slider({ value, onChange, disabled }) {
  return (
    <div className="slider-group">
      <input
        type="range" min={0} max={100}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ flex: 1 }}
      />
      <span className="slider-val">{Math.round(value * 100)}%</span>
    </div>
  );
}

export default function PolicySettings() {
  const [policies, setPolicies] = useState([]);
  const [selectedId, setSelectedId] = useState('general');
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState(null);
  const [ruleContains, setRuleContains] = useState('');
  const [ruleCategory, setRuleCategory] = useState('harassment');
  const [ruleAction, setRuleAction] = useState('block');

  useEffect(() => {
    api.policies().then((p) => {
      setPolicies(p);
      const match = p.find((x) => x.id === selectedId) || p[0];
      if (match) { setSelectedId(match.id); setDraft(JSON.parse(JSON.stringify(match))); }
    }).catch((e) => setError(e.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const original = useMemo(() => policies.find((p) => p.id === selectedId), [policies, selectedId]);
  const dirty = original && JSON.stringify(original) !== JSON.stringify(draft);

  function selectPlatform(id) {
    const p = policies.find((x) => x.id === id);
    if (p) { setSelectedId(id); setDraft(JSON.parse(JSON.stringify(p))); setSaved(null); setError(null); }
  }

  function updateCat(catId, patch) {
    if (!draft) return;
    const next = JSON.parse(JSON.stringify(draft));
    next.categories[catId] = { ...next.categories[catId], ...patch };
    const c = next.categories[catId];
    if (c.reviewThreshold > c.autoActionThreshold) {
      if ('autoActionThreshold' in patch) c.reviewThreshold = c.autoActionThreshold;
      else c.autoActionThreshold = c.reviewThreshold;
    }
    setDraft(next);
  }

  async function save() {
    if (!draft) return;
    setError(null);
    try {
      const updated = await api.savePolicy(draft);
      setPolicies((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      setDraft(JSON.parse(JSON.stringify(updated)));
      setSaved('✅ Saved! New decisions on this platform use these thresholds.');
    } catch (e) { setError(e.message); }
  }

  async function reset() {
    try {
      const fresh = await api.resetPolicies();
      setPolicies(fresh);
      const match = fresh.find((p) => p.id === selectedId) || fresh[0];
      if (match) { setSelectedId(match.id); setDraft(JSON.parse(JSON.stringify(match))); }
      setSaved('Reset to shipped defaults.');
    } catch (e) { setError(e.message); }
  }

  function addRule() {
    if (!ruleContains.trim() || !draft) return;
    const rules = [...draft.customRules, {
      id: `rule_${Date.now()}`,
      description: `If content contains "${ruleContains}", ${ruleAction}.`,
      contains: ruleContains.trim(),
      category: ruleCategory,
      action: ruleAction,
    }];
    setDraft({ ...draft, customRules: rules });
    setRuleContains('');
  }

  function removeRule(id) {
    setDraft({ ...draft, customRules: draft.customRules.filter((r) => r.id !== id) });
  }

  if (!draft) return <div className="page"><p className="muted">Loading policies…</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">⚙️ Policy Settings</h1>
        <p className="page-subtitle">Configure per-platform thresholds, category toggles, and keyword rules</p>
      </div>

      <div className="platform-tabs">
        {policies.map((p) => (
          <button
            key={p.id}
            id={`tab-${p.id}`}
            className={`platform-tab ${p.id === selectedId ? 'active' : ''}`}
            onClick={() => selectPlatform(p.id)}
          >
            {p.name}
          </button>
        ))}
        <button className="platform-tab" onClick={reset} style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          ↺ Reset All Defaults
        </button>
      </div>

      <div className="card">
        <div className="form-group">
          <label className="form-label">Platform Name</label>
          <input
            id="policy-name"
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            id="policy-desc"
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>

        <h3 className="section-title" style={{ marginTop: 24 }}>Category Thresholds</h3>
        <p className="muted small" style={{ marginBottom: 12 }}>
          Lower Review threshold → more content sent to human queue. Lower Auto-block threshold → more content automatically blocked.
        </p>
        <div className="table-wrap">
          <table className="policy-table">
            <thead>
              <tr>
                <th>Category</th>
                <th style={{ width: 60 }}>Enabled</th>
                <th>Review ≥</th>
                <th>Auto-block ≥</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => {
                const c = draft.categories[cat.id] || {};
                return (
                  <tr key={cat.id} className={c.enabled ? '' : 'disabled'}>
                    <td>{cat.label}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        id={`enabled-${cat.id}`}
                        checked={Boolean(c.enabled)}
                        onChange={(e) => updateCat(cat.id, { enabled: e.target.checked })}
                      />
                    </td>
                    <td><Slider value={c.reviewThreshold ?? 0.45} disabled={!c.enabled} onChange={(v) => updateCat(cat.id, { reviewThreshold: v })} /></td>
                    <td><Slider value={c.autoActionThreshold ?? 0.85} disabled={!c.enabled} onChange={(v) => updateCat(cat.id, { autoActionThreshold: v })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 className="section-title" style={{ marginTop: 28 }}>Custom Keyword Rules</h3>
        <p className="muted small" style={{ marginBottom: 12 }}>Rules match any substring (case-insensitive) and override model confidence.</p>

        {draft.customRules.map((r) => (
          <div key={r.id} className="rule-item">
            contains <span className="rule-phrase">"{r.contains}"</span>
            → <strong>{r.action}</strong> as {r.category.replace(/_/g, ' ')}
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => removeRule(r.id)}>
              Remove
            </button>
          </div>
        ))}

        <div className="rule-add">
          <input
            id="rule-phrase"
            type="text"
            placeholder="phrase to match"
            value={ruleContains}
            onChange={(e) => setRuleContains(e.target.value)}
            style={{ flex: 1, minWidth: 120 }}
          />
          <select id="rule-category" value={ruleCategory} onChange={(e) => setRuleCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select id="rule-action" value={ruleAction} onChange={(e) => setRuleAction(e.target.value)}>
            <option value="block">Block</option>
            <option value="review">Review</option>
            <option value="allow">Allow</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={addRule}>+ Add Rule</button>
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
          <button id="save-policy" className="btn btn-primary" onClick={save} disabled={!dirty}>
            {dirty ? '💾 Save Policy' : 'No Changes'}
          </button>
          {saved && <span className="banner banner-success" style={{ padding: '6px 12px' }}>{saved}</span>}
          {error && <span className="banner banner-error" style={{ padding: '6px 12px' }}>⚠ {error}</span>}
        </div>

        <p className="muted small" style={{ marginTop: 12 }}>
          Changes take effect immediately — the next moderation request will use the new thresholds.
          Disable a category and its flags are completely ignored for this platform.
        </p>
      </div>
    </div>
  );
}
