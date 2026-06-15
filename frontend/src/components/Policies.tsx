import { useMemo, useState } from "react";
import { api } from "../api";
import type { CategoryMeta, CustomRule, HarmCategory, PlatformPolicy } from "../types";

export function Policies({
  policies,
  categories,
  onChange,
}: {
  policies: PlatformPolicy[];
  categories: CategoryMeta[];
  onChange: (policies: PlatformPolicy[]) => void;
}) {
  const [selectedId, setSelectedId] = useState(policies[0]?.id ?? "general");
  const [draft, setDraft] = useState<PlatformPolicy | null>(
    () => structuredClone(policies.find((p) => p.id === selectedId) ?? policies[0] ?? null)
  );
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const original = useMemo(
    () => policies.find((p) => p.id === selectedId) ?? null,
    [policies, selectedId]
  );
  const dirty = JSON.stringify(original) !== JSON.stringify(draft);

  function selectPlatform(id: string) {
    setSelectedId(id);
    setDraft(structuredClone(policies.find((p) => p.id === id) ?? null));
    setSaved(null);
    setError(null);
  }

  function updateCategory(cat: HarmCategory, patch: Partial<PlatformPolicy["categories"][HarmCategory]>) {
    if (!draft) return;
    const next = structuredClone(draft);
    next.categories[cat] = { ...next.categories[cat], ...patch };
    // Keep review threshold <= auto-action threshold.
    const c = next.categories[cat];
    if (c.reviewThreshold > c.autoActionThreshold) {
      if ("autoActionThreshold" in patch) c.reviewThreshold = c.autoActionThreshold;
      else c.autoActionThreshold = c.reviewThreshold;
    }
    setDraft(next);
  }

  async function save() {
    if (!draft) return;
    setError(null);
    try {
      const updated = await api.savePolicy(draft);
      const next = policies.map((p) => (p.id === updated.id ? updated : p));
      if (!next.find((p) => p.id === updated.id)) next.push(updated);
      onChange(next);
      setDraft(structuredClone(updated));
      setSaved("Saved. New decisions on this platform use these thresholds.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function resetAll() {
    const fresh = await api.resetPolicies();
    onChange(fresh);
    setDraft(structuredClone(fresh.find((p) => p.id === selectedId) ?? fresh[0] ?? null));
    setSaved("Reset to shipped defaults.");
  }

  if (!draft) return <p className="muted">No policy selected.</p>;

  return (
    <div>
      <div className="policy-tabs">
        {policies.map((p) => (
          <button
            key={p.id}
            className={`chip ${p.id === selectedId ? "chip-active" : ""}`}
            onClick={() => selectPlatform(p.id)}
          >
            {p.name}
          </button>
        ))}
        <button className="chip chip-ghost" onClick={resetAll}>
          Reset all to defaults
        </button>
      </div>

      <section className="panel">
        <input
          className="title-input"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <textarea
          rows={2}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />

        <table className="policy-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Enabled</th>
              <th>Review ≥</th>
              <th>Auto-block ≥</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const c = draft.categories[cat.id];
              if (!c) return null;
              return (
                <tr key={cat.id} className={c.enabled ? "" : "row-disabled"}>
                  <td>{cat.label}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={c.enabled}
                      onChange={(e) => updateCategory(cat.id, { enabled: e.target.checked })}
                    />
                  </td>
                  <td>
                    <Slider
                      value={c.reviewThreshold}
                      disabled={!c.enabled}
                      onChange={(v) => updateCategory(cat.id, { reviewThreshold: v })}
                    />
                  </td>
                  <td>
                    <Slider
                      value={c.autoActionThreshold}
                      disabled={!c.enabled}
                      onChange={(v) => updateCategory(cat.id, { autoActionThreshold: v })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <CustomRules
          rules={draft.customRules}
          categories={categories}
          onChange={(customRules) => setDraft({ ...draft, customRules })}
        />

        <div className="policy-actions">
          <button className="primary" onClick={save} disabled={!dirty}>
            {dirty ? "Save policy" : "No changes"}
          </button>
          {saved && <span className="ok">{saved}</span>}
          {error && <span className="error">⚠ {error}</span>}
        </div>
        <p className="muted small">
          Lower the thresholds and the same content moves from allowed → review → blocked. Disable a
          category and its flags are ignored entirely for this platform.
        </p>
      </section>
    </div>
  );
}

function Slider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <span className="slider">
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <span className="slider-val">{Math.round(value * 100)}%</span>
    </span>
  );
}

function CustomRules({
  rules,
  categories,
  onChange,
}: {
  rules: CustomRule[];
  categories: CategoryMeta[];
  onChange: (rules: CustomRule[]) => void;
}) {
  const [contains, setContains] = useState("");
  const [category, setCategory] = useState<HarmCategory>(categories[0]?.id ?? "harassment");
  const [action, setAction] = useState<CustomRule["action"]>("block");

  function add() {
    if (!contains.trim()) return;
    onChange([
      ...rules,
      {
        id: `rule_${Date.now()}`,
        description: `If content contains “${contains}”, ${action}.`,
        contains: contains.trim(),
        category,
        action,
      },
    ]);
    setContains("");
  }

  return (
    <div className="custom-rules">
      <h3>Custom keyword rules</h3>
      {rules.length === 0 && <p className="muted small">No custom rules.</p>}
      <ul>
        {rules.map((r) => (
          <li key={r.id}>
            <code>contains “{r.contains}”</code> → <b>{r.action}</b> as {r.category}
            <button className="link-btn" onClick={() => onChange(rules.filter((x) => x.id !== r.id))}>
              remove
            </button>
          </li>
        ))}
      </ul>
      <div className="rule-add">
        <input
          placeholder="phrase to match"
          value={contains}
          onChange={(e) => setContains(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value as HarmCategory)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value as CustomRule["action"])}>
          <option value="block">block</option>
          <option value="review">review</option>
          <option value="allow">allow</option>
        </select>
        <button onClick={add}>Add rule</button>
      </div>
    </div>
  );
}
