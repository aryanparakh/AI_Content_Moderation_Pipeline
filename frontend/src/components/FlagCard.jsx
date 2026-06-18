import { ActionBadge } from './RoutingBadge.jsx';

export default function FlagCard({ flag }) {
  const conf = Math.round(flag.confidence * 100);
  const severityCls = flag.severity === 'high' ? 'high' : flag.severity === 'medium' ? 'medium' : 'low';

  return (
    <div className="flag-card">
      <div className="flag-card-header">
        <span className="flag-category">{flag.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
        <span className={`badge badge-${flag.severity}`}>{flag.severity}</span>
        {flag.action && <ActionBadge action={flag.action} />}
        <span className="muted small" style={{ marginLeft: 'auto' }}>{conf}% confidence</span>
      </div>

      <div className="confidence-bar-wrap">
        <div className="confidence-bar-bg">
          <div className={`confidence-bar ${severityCls}`} style={{ width: `${conf}%` }} />
        </div>
      </div>

      {flag.segment && (
        <div className="flag-segment">
          <strong>Trigger:</strong> "{flag.segment}"
        </div>
      )}

      <div className="flag-reasoning">{flag.reasoning}</div>

      {flag.explanation && (
        <div className="flag-explanation">📋 {flag.explanation}</div>
      )}
    </div>
  );
}
