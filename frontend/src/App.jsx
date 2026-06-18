import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Navbar from './components/Navbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SubmitContent from './pages/SubmitContent.jsx';
import ReviewQueue from './pages/ReviewQueue.jsx';
import PolicySettings from './pages/PolicySettings.jsx';

export default function App() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
  }, []);

  return (
    <div className="app">
      <Navbar />

      {health && !health.apiKeyConfigured && (
        <div className="banner banner-warn" style={{ margin: '12px 24px 0', borderRadius: 8 }}>
          ⚠ <strong>GROQ_API_KEY</strong> is not set — classification calls will fail.
          Add it to <code>backend/.env</code> and restart the server.
        </div>
      )}
      {health && health.ok && health.apiKeyConfigured && (
        <div className="banner banner-info" style={{ margin: '12px 24px 0', borderRadius: 8 }}>
          🤖 Model: <strong>{health.model}</strong> · Backend connected
        </div>
      )}
      {health && !health.ok && (
        <div className="banner banner-warn" style={{ margin: '12px 24px 0', borderRadius: 8 }}>
          ⚠ Cannot reach backend. Start it with <code>npm run dev</code> in <code>backend/</code>.
        </div>
      )}

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/moderate" element={<SubmitContent />} />
        <Route path="/queue" element={<ReviewQueue />} />
        <Route path="/policies" element={<PolicySettings />} />
      </Routes>
    </div>
  );
}
