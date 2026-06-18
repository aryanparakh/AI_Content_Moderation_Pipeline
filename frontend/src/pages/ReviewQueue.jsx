import { useEffect, useState } from 'react';
import { api } from '../api.js';
import FlagCard from '../components/FlagCard.jsx';
import { RoutingBadge, ActionBadge } from '../components/RoutingBadge.jsx';

function HighlightedContent({ content, segments }) {
  if (!segments?.length) return <span>{content}</span>;
  const marks = [];
  for (const seg of segments) {
    if (!seg) continue;
    let idx = 0;
    while (true) {
      const found = content.toLowerCase().indexOf(seg.toLowerCase(), idx);
      if (found === -1) break;
      marks.push({ start: found, end: found + seg.length });
      idx = found + 1;
    }
  }
  marks.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const m of marks) {
    if (merged.length && m.start <= merged.at(-1).end) {
      merged.at(-1).end = Math.max(merged.at(-1).end, m.end);
    } else merged.push({ ...m });
  }
  const parts = [];
  let last = 0;
  for (const m of merged) {
    if (m.start > last) parts.push(<span key={`t${last}`}>{content.slice(last, m.start)}</span>);
    parts.push(<mark key={`m${m.start}`}>{content.slice(m.start, m.end)}</mark>);
    last = m.end;
  }
  if (last < content.length) parts.push(<span key={`t${last}`}>{content.slice(last)}</span>);
  return <>{parts}</>;
}

export default function ReviewQueue() {
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null);
  const [reviewer, setReviewer] = useState('moderator-1');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [q, s] = await Promise.all([api.queue(), api.stats()]);
      setQueue(q);
      setStats(s);
      if (selected) setSelected(q.find((r) => r.id === selected.id) ?? null);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decide(finalAction) {
    if (!selected) return;
    setBusy(true); setError(null);
    try {
      await api.review(selected.id, reviewer, finalAction, notes || undefined);
      setSelected(null);
      setNotes('');
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const segments = selected?.decision?.perFlag?.map((f) => f.segment) || [];

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">👥 Human Review Queue</h1>
        <p className="page-subtitle">Review AI-flagged content, see full context and reasoning, then make the final call</p>
      </div>

      {stats && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card"><div className="stat-value">{stats.pendingReview}</div><div className="stat-label">Pending Review</div></div>
          <div className="stat-card"><div className="stat-value">{stats.reviewed}</div><div className="stat-label">Reviewed</div></div>
          <div className="stat-card"><div className="stat-value">{stats.humanOverrides}</div><div className="stat-label">AI Overrides</div></div>
          <div className="stat-card"><div className="stat-value">{stats.aiHumanAgreement === null ? '—' : `${Math.round(stats.aiHumanAgreement * 100)}%`}</div><div className="stat-label">Agreement Rate</div></div>
        </div>
      )}

      {error && <div className="banner banner-error">{error}</div>}

      <div className="grid-2">
        {/* Left: Queue list */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-solid)' }}>
            <div className="flex-between">
              <h2 className="card-title" style={{ margin: 0 }}>Queue ({queue.length})</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="muted small">Reviewer:</span>
                <input
                  id="reviewer-input"
                  type="text"
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  style={{ width: 140, padding: '4px 8px' }}
                />
              </div>
            </div>
          </div>

          {queue.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎉</div>
              <p>Queue is empty. Submit borderline content to populate it.</p>
            </div>
          ) : (
            <ul className="queue-list">
              {queue.map((r) => (
                <li
                  key={r.id}
                  className={`queue-item ${selected?.id === r.id ? 'selected' : ''}`}
                  onClick={() => { setSelected(r); setNotes(''); }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <RoutingBadge routing={r.decision.routing} />
                    <span className="muted small">{r.policyRef?.name}</span>
                  </div>
                  <div className="queue-item-content">{r.content}</div>
                  {r.decision.primaryFlag && (
                    <div className="queue-item-meta">→ {r.decision.primaryFlag.category.replace(/_/g, ' ')} ({Math.round(r.decision.primaryFlag.confidence * 100)}%)</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: Reviewer workspace */}
        <div className="card">
          <h2 className="card-title">Reviewer Workspace</h2>

          {!selected && (
            <div className="empty-state">
              <div className="empty-icon">👈</div>
              <p>Select a queued item to review.</p>
            </div>
          )}

          {selected && (
            <div>
              <div className="decision-header">
                <span className="muted small">AI recommends:</span>
                <ActionBadge action={selected.decision.action} />
              </div>

              <div className="section-title">Content</div>
              <div className="content-box">
                <HighlightedContent content={selected.content} segments={segments} />
              </div>

              <div className="section-title">Full Context</div>
              <ul className="ctx-list">
                <li><b>Platform:</b> {selected.policyRef?.name}</li>
                {selected.context.surface && <li><b>Surface:</b> {selected.context.surface}</li>}
                {selected.context.userHistory && <li><b>Author history:</b> {selected.context.userHistory}</li>}
                {selected.context.thread?.length > 0 && (
                  <li>
                    <b>Thread:</b>
                    <div className="thread">
                      {selected.context.thread.map((m, i) => (
                        <div key={i} className="thread-msg">
                          <span className="thread-author">{m.author}:</span> {m.text}
                        </div>
                      ))}
                    </div>
                  </li>
                )}
              </ul>

              <div className="section-title">AI Reasoning</div>
              <p className="muted">{selected.classification.contextNotes || '—'}</p>

              <div className="section-title">Per-Category Flags</div>
              {selected.decision.perFlag.map((f, i) => <FlagCard key={i} flag={f} />)}

              <div className="section-title">Your Decision</div>
              <textarea
                id="review-notes"
                rows={2}
                placeholder="Reviewer notes (optional) — captured as model-improvement feedback"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ marginBottom: 12 }}
              />

              <div className="review-actions">
                <button id="btn-allow"  className="btn btn-success" onClick={() => decide('allow')}  disabled={busy}>✅ Allow</button>
                <button id="btn-review" className="btn btn-warning" onClick={() => decide('review')} disabled={busy}>⏳ Keep Under Review</button>
                <button id="btn-block"  className="btn btn-danger"  onClick={() => decide('block')}  disabled={busy}>🚫 Block</button>
              </div>

              <p className="muted small" style={{ marginTop: 10 }}>
                Choosing anything other than "{selected.decision.action}" records an override and saves it as feedback for model improvement.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
