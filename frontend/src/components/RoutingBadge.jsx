const ROUTING_CONFIG = {
  auto_allow:   { label: 'Auto Allowed',  cls: 'badge-auto_allow',   icon: '✅' },
  auto_block:   { label: 'Auto Blocked',  cls: 'badge-auto_block',   icon: '🚫' },
  human_review: { label: 'Human Review',  cls: 'badge-human_review', icon: '👁️' },
};

const ACTION_CONFIG = {
  allow:  { label: 'Allow',  cls: 'badge-allow',  icon: '✓' },
  review: { label: 'Review', cls: 'badge-review', icon: '⏳' },
  block:  { label: 'Block',  cls: 'badge-block',  icon: '✕' },
};

export function RoutingBadge({ routing }) {
  const cfg = ROUTING_CONFIG[routing] || { label: routing, cls: '', icon: '?' };
  return <span className={`badge ${cfg.cls}`}>{cfg.icon} {cfg.label}</span>;
}

export function ActionBadge({ action }) {
  const cfg = ACTION_CONFIG[action] || { label: action, cls: '', icon: '?' };
  return <span className={`badge ${cfg.cls}`}>{cfg.icon} {cfg.label}</span>;
}
