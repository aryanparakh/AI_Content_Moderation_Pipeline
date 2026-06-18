import { NavLink } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/moderate',  label: 'Moderate',  icon: '🔍' },
  { to: '/queue',     label: 'Review Queue', icon: '👥' },
  { to: '/policies',  label: 'Policies',  icon: '⚙️' },
];

export default function Navbar() {
  return (
    <nav className="navbar">
      <a className="navbar-brand" href="/dashboard">
        <span className="logo">🛡️</span>
        <div>
          <div className="brand-title">Content Moderation Pipeline</div>
          <div className="brand-sub">AI-powered · Multi-stage · Explainable</div>
        </div>
      </a>
      <div className="navbar-nav">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="icon">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
