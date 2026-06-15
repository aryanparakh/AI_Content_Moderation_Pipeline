import type { Action, FlagDecision, HarmCategory, ModerationRecord } from "../types";

export const CATEGORY_LABELS: Record<HarmCategory, string> = {
  hate_speech: "Hate speech",
  harassment: "Harassment",
  spam: "Spam",
  misinformation: "Misinformation",
  graphic_violence: "Graphic violence",
  adult_content: "Adult content",
  self_harm: "Self-harm",
};

export function ActionBadge({ action }: { action: Action }) {
  return <span className={`badge action-${action}`}>{action.toUpperCase()}</span>;
}

export function RoutingBadge({ routing }: { routing: ModerationRecord["decision"]["routing"] }) {
  const label =
    routing === "auto_allow" ? "Auto-allowed" : routing === "auto_block" ? "Auto-blocked" : "Human review";
  return <span className={`badge routing-${routing}`}>{label}</span>;
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = value >= 0.85 ? "high" : value >= 0.45 ? "mid" : "low";
  return (
    <span className="confbar" title={`${pct}% confidence`}>
      <span className={`confbar-fill conf-${tone}`} style={{ width: `${pct}%` }} />
      <span className="confbar-label">{pct}%</span>
    </span>
  );
}

/** Render content with the given offending segments highlighted. */
export function HighlightedContent({ content, segments }: { content: string; segments: string[] }) {
  const uniq = [...new Set(segments.filter((s) => s && content.includes(s)))].sort(
    (a, b) => b.length - a.length
  );
  if (uniq.length === 0) return <span className="content-text">{content}</span>;

  // Build a list of [start,end] highlight ranges, then stitch.
  const ranges: [number, number][] = [];
  for (const seg of uniq) {
    let from = 0;
    let idx = content.indexOf(seg, from);
    while (idx !== -1) {
      ranges.push([idx, idx + seg.length]);
      from = idx + seg.length;
      idx = content.indexOf(seg, from);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([s, e], i) => {
    if (s > cursor) parts.push(<span key={`t${i}`}>{content.slice(cursor, s)}</span>);
    parts.push(
      <mark key={`m${i}`} className="seg">
        {content.slice(s, e)}
      </mark>
    );
    cursor = e;
  });
  if (cursor < content.length) parts.push(<span key="tail">{content.slice(cursor)}</span>);
  return <span className="content-text">{parts}</span>;
}

export function FlagRow({ flag }: { flag: FlagDecision }) {
  return (
    <div className={`flag-row flag-${flag.action}`}>
      <div className="flag-head">
        <span className="flag-cat">{CATEGORY_LABELS[flag.category]}</span>
        <ConfidenceBar value={flag.confidence} />
        <span className={`sev sev-${flag.severity}`}>{flag.severity}</span>
        <ActionBadge action={flag.action} />
      </div>
      {flag.segment && (
        <div className="flag-segment">
          Offending segment: <q>{flag.segment}</q>
        </div>
      )}
      <div className="flag-reason">{flag.reasoning}</div>
      <div className="flag-explain">{flag.explanation}</div>
    </div>
  );
}
