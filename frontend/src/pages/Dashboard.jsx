import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import StatCard from '../components/StatCard.jsx';
import { RoutingBadge, ActionBadge } from '../components/RoutingBadge.jsx';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.stats(), api.records()])
      .then(([s, r]) => { setStats(s); setRecords(r.slice(0, 10)); })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">📊 Dashboard</h1>
        <p className="page-subtitle">Live overview of your moderation pipeline</p>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {stats && (
        <div className="stats-grid">
          <StatCard icon="📝" label="Total Processed"   value={stats.totalProcessed} />
          <StatCard icon="✅" label="Auto Allowed"      value={stats.autoAllowed} />
          <StatCard icon="🚫" label="Auto Blocked"      value={stats.autoBlocked} />
          <StatCard icon="👁️" label="Pending Review"    value={stats.pendingReview} highlight />
          <StatCard icon="✔️" label="Reviewed"          value={stats.reviewed} />
          <StatCard icon="🔄" label="Human Overrides"   value={stats.humanOverrides} />
          <StatCard
            icon="🤝"
            label="AI / Human Agreement"
            value={stats.aiHumanAgreement === null ? '—' : `${Math.round(stats.aiHumanAgreement * 100)}%`}
          />
        </div>
      )}

      <div className="card">
        <div className="flex-between" style={{ marginBottom: 16 }}>
          <h2 className="card-title" style={{ margin: 0 }}>Recent Moderation Records</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/moderate')}>
            + Moderate Content
          </button>
        </div>

        {records.length === 0 && !error && (
          <div className="empty-state">
            <div className="empty-icon">🛡️</div>
            <p>No records yet. Submit some content to get started.</p>
          </div>
        )}

        {records.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Platform</th>
                  <th>Content</th>
                  <th>Routing</th>
                  <th>Action</th>
                  <th>Model</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="muted small">{timeAgo(r.createdAt)}</td>
                    <td><span className="muted">{r.policyRef?.name}</span></td>
                    <td><div className="content-preview">{r.content}</div></td>
                    <td><RoutingBadge routing={r.decision.routing} /></td>
                    <td><ActionBadge action={r.decision.action} /></td>
                    <td className="muted small">{r.classification.latencyMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
