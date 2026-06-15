import { useEffect, useState } from "react";
import { api } from "../api";
import type { Action, ModerationRecord, Stats } from "../types";
import { ActionBadge, FlagRow, HighlightedContent, RoutingBadge } from "./shared";

export function ReviewQueue() {
  const [queue, setQueue] = useState<ModerationRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selected, setSelected] = useState<ModerationRecord | null>(null);
  const [reviewer, setReviewer] = useState("moderator-1");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [q, s] = await Promise.all([api.queue(), api.stats()]);
      setQueue(q);
      setStats(s);
      if (selected) setSelected(q.find((r) => r.id === selected.id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decide(id: string, finalAction: Action, notes?: string) {
    setError(null);
    try {
      await api.review(id, reviewer, finalAction, notes);
      setSelected(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      {stats && (
        <div className="statbar">
          <Stat label="Processed" value={stats.totalProcessed} />
          <Stat label="Auto-allowed" value={stats.autoAllowed} />
          <Stat label="Auto-blocked" value={stats.autoBlocked} />
          <Stat label="Pending review" value={stats.pendingReview} highlight />
          <Stat label="Reviewed" value={stats.reviewed} />
          <Stat label="Human overrides" value={stats.humanOverrides} />
          <Stat
            label="AI/human agreement"
            value={stats.aiHumanAgreement === null ? "—" : `${Math.round(stats.aiHumanAgreement * 100)}%`}
          />
        </div>
      )}
      {error && <p className="error">⚠ {error}</p>}

      <div className="grid">
        <section className="panel">
          <h2>Review queue ({queue.length})</h2>
          <label className="inline">
            Reviewer:&nbsp;
            <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
          </label>
          {queue.length === 0 && (
            <p className="muted">
              Queue is empty. Submit borderline content on the Moderate tab to populate it.
            </p>
          )}
          <ul className="queue-list">
            {queue.map((r) => (
              <li
                key={r.id}
                className={selected?.id === r.id ? "active" : ""}
                onClick={() => setSelected(r)}
              >
                <div className="q-top">
                  <RoutingBadge routing={r.decision.routing} />
                  <span className="muted small">{r.policyRef.name}</span>
                </div>
                <div className="q-content">{r.content.slice(0, 90)}</div>
                {r.decision.primaryFlag && (
                  <div className="muted small">→ {r.decision.primaryFlag.category}</div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Reviewer workspace</h2>
          {!selected && <p className="muted">Select a queued item to review.</p>}
          {selected && (
            <ReviewDetail record={selected} onDecide={decide} />
          )}
        </section>
      </div>
    </div>
  );
}

function ReviewDetail({
  record,
  onDecide,
}: {
  record: ModerationRecord;
  onDecide: (id: string, action: Action, notes?: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const segments = record.decision.perFlag.map((f) => f.segment);

  return (
    <div className="decision">
      <div className="decision-head">
        <span className="muted small">AI recommends:</span>
        <ActionBadge action={record.decision.action} />
      </div>

      <h3>Content</h3>
      <blockquote>
        <HighlightedContent content={record.content} segments={segments} />
      </blockquote>

      <h3>Full context</h3>
      <ul className="ctx">
        <li>
          <b>Platform:</b> {record.policyRef.name}
        </li>
        {record.context.surface && (
          <li>
            <b>Surface:</b> {record.context.surface}
          </li>
        )}
        {record.context.userHistory && (
          <li>
            <b>Author history:</b> {record.context.userHistory}
          </li>
        )}
        {record.context.thread && record.context.thread.length > 0 && (
          <li>
            <b>Thread:</b>
            <div className="thread">
              {record.context.thread.map((m, i) => (
                <div key={i}>
                  <span className="thread-author">{m.author}:</span> {m.text}
                </div>
              ))}
            </div>
          </li>
        )}
      </ul>

      <h3>AI reasoning</h3>
      <p className="muted">{record.classification.contextNotes}</p>
      {record.decision.perFlag.map((f, i) => (
        <FlagRow key={i} flag={f} />
      ))}

      <h3>Your decision</h3>
      <textarea
        rows={2}
        placeholder="Reviewer notes (optional) — these become labelled feedback"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="review-actions">
        <button className="btn-allow" onClick={() => onDecide(record.id, "allow", notes)}>
          Allow
        </button>
        <button className="btn-review" onClick={() => onDecide(record.id, "review", notes)}>
          Keep under review
        </button>
        <button className="btn-block" onClick={() => onDecide(record.id, "block", notes)}>
          Block
        </button>
      </div>
      <p className="muted small">
        Choosing anything other than “{record.decision.action}” records an override and is captured as
        model-improvement feedback.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className={`stat ${highlight ? "stat-hi" : ""}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
