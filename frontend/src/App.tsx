import { useEffect, useState } from "react";
import { api, type Health } from "./api";
import type { CategoryMeta, PlatformPolicy } from "./types";
import { Moderate } from "./components/Moderate";
import { ReviewQueue } from "./components/ReviewQueue";
import { Policies } from "./components/Policies";

type Tab = "moderate" | "queue" | "policies";

export function App() {
  const [tab, setTab] = useState<Tab>("moderate");
  const [health, setHealth] = useState<Health | null>(null);
  const [policies, setPolicies] = useState<PlatformPolicy[]>([]);
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [h, p, c] = await Promise.all([api.health(), api.policies(), api.categories()]);
        setHealth(h);
        setPolicies(p);
        setCategories(c);
      } catch (e) {
        setLoadErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🛡️</span>
          <div>
            <h1>Content Moderation Pipeline</h1>
            <p className="muted small">
              Classify · context-aware analysis · confidence routing · explainable decisions · per-platform policy
            </p>
          </div>
        </div>
        <nav className="tabs">
          <button className={tab === "moderate" ? "tab active" : "tab"} onClick={() => setTab("moderate")}>
            Moderate
          </button>
          <button className={tab === "queue" ? "tab active" : "tab"} onClick={() => setTab("queue")}>
            Review queue
          </button>
          <button className={tab === "policies" ? "tab active" : "tab"} onClick={() => setTab("policies")}>
            Policies
          </button>
        </nav>
      </header>

      {health && !health.apiKeyConfigured && (
        <div className="warn-banner">
          ⚠ Backend has no ANTHROPIC_API_KEY configured — classification calls will fail. Add it to
          <code>backend/.env</code> and restart the API.
        </div>
      )}
      {health && (
        <div className="info-banner">
          Model: <b>{health.model}</b> · adaptive thinking: <b>{health.thinking ? "on" : "off"}</b>
        </div>
      )}
      {loadErr && (
        <div className="warn-banner">
          ⚠ Could not reach the backend ({loadErr}). Start it with <code>npm run dev</code> in
          <code>backend/</code>.
        </div>
      )}

      <main>
        {tab === "moderate" && policies.length > 0 && <Moderate policies={policies} />}
        {tab === "queue" && <ReviewQueue />}
        {tab === "policies" && policies.length > 0 && (
          <Policies policies={policies} categories={categories} onChange={setPolicies} />
        )}
        {policies.length === 0 && !loadErr && <p className="muted">Loading…</p>}
      </main>
    </div>
  );
}
