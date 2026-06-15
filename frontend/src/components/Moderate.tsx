import { useState } from "react";
import { api } from "../api";
import type { ModerationRecord, PlatformPolicy } from "../types";
import { ActionBadge, FlagRow, HighlightedContent, RoutingBadge } from "./shared";

const SAMPLES = [
  {
    label: "Gaming banter (context: friends)",
    content: "I'm going to kill you, you're dead next round 😂",
    platformId: "general",
    surface: "competitive online match voice chat",
    userHistory: "Long-time friends, no prior reports.",
  },
  {
    label: "Same words, credible threat (kids platform)",
    content: "I'm going to kill you, you're dead next round 😂",
    platformId: "kids",
    surface: "DM to a 12-year-old after an argument",
    userHistory: "Adult account, 2 prior harassment strikes.",
  },
  {
    label: "Scam spam",
    content: "🔥 MAKE $5000/DAY! Click http://legit-cash.biz code RICH99 💰",
    platformId: "general",
    surface: "",
    userHistory: "",
  },
  {
    label: "Health misinformation",
    content: "Drinking bleach cures cancer in 48 hours — doctors hide this!",
    platformId: "general",
    surface: "",
    userHistory: "",
  },
];

export function Moderate({ policies }: { policies: PlatformPolicy[] }) {
  const [content, setContent] = useState(SAMPLES[0].content);
  const [platformId, setPlatformId] = useState(policies[0]?.id ?? "general");
  const [surface, setSurface] = useState(SAMPLES[0].surface);
  const [userHistory, setUserHistory] = useState(SAMPLES[0].userHistory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ModerationRecord | null>(null);

  function loadSample(i: number) {
    const s = SAMPLES[i];
    setContent(s.content);
    setPlatformId(s.platformId);
    setSurface(s.surface);
    setUserHistory(s.userHistory);
    setResult(null);
    setError(null);
  }

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const record = await api.moderate(content, {
        platformId,
        surface: surface || undefined,
        userHistory: userHistory || undefined,
      });
      setResult(record);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <section className="panel">
        <h2>Submit content</h2>
        <div className="samples">
          {SAMPLES.map((s, i) => (
            <button key={i} className="chip" onClick={() => loadSample(i)}>
              {s.label}
            </button>
          ))}
        </div>

        <label>Content</label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} />

        <label>Platform (policy applied)</label>
        <select value={platformId} onChange={(e) => setPlatformId(e.target.value)}>
          {policies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <label>Surface / setting (context)</label>
        <input
          value={surface}
          onChange={(e) => setSurface(e.target.value)}
          placeholder="e.g. competitive gaming lobby"
        />

        <label>Author history (context)</label>
        <input
          value={userHistory}
          onChange={(e) => setUserHistory(e.target.value)}
          placeholder="e.g. new account, 2 prior strikes"
        />

        <button className="primary" onClick={run} disabled={busy || !content.trim()}>
          {busy ? "Classifying…" : "Moderate"}
        </button>
        {error && <p className="error">⚠ {error}</p>}
      </section>

      <section className="panel">
        <h2>Decision</h2>
        {!result && !busy && <p className="muted">Submit content to see the moderation decision.</p>}
        {busy && <p className="muted">Running classifier + policy engine…</p>}
        {result && <DecisionView record={result} />}
      </section>
    </div>
  );
}

function DecisionView({ record }: { record: ModerationRecord }) {
  const { decision, classification } = record;
  const segments = decision.perFlag.map((f) => f.segment);
  return (
    <div className="decision">
      <div className="decision-head">
        <RoutingBadge routing={decision.routing} />
        <ActionBadge action={decision.action} />
        <span className="muted small">
          {record.policyRef.name} · {classification.model} · {classification.latencyMs} ms
        </span>
      </div>
      <p className="summary">{decision.summary}</p>

      <h3>Content (offending segments highlighted)</h3>
      <blockquote>
        <HighlightedContent content={record.content} segments={segments} />
      </blockquote>

      <h3>Context analysis</h3>
      <p className="muted">{classification.contextNotes || "—"}</p>
      <p className="muted small">Overall: {classification.overallReasoning}</p>

      <h3>Per-category flags &amp; explainability</h3>
      {decision.perFlag.length === 0 ? (
        <p className="muted">No harm categories detected.</p>
      ) : (
        decision.perFlag.map((f, i) => <FlagRow key={i} flag={f} />)
      )}
    </div>
  );
}
