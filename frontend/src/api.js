/** Thin fetch wrapper — all API calls go through here. */

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://ai-content-moderation-pipeline.onrender.com";

async function req(url, options = {}) {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  health:     ()              => req('/api/health'),
  categories: ()              => req('/api/categories'),

  moderate: (content, context) =>
    req('/api/moderate', { method: 'POST', body: JSON.stringify({ content, context }) }),

  records: ()   => req('/api/records'),
  record:  (id) => req(`/api/records/${id}`),

  policies:     ()       => req('/api/policies'),
  policy:       (id)     => req(`/api/policies/${id}`),
  savePolicy:   (policy) => req(`/api/policies/${policy.id}`, { method: 'PUT', body: JSON.stringify(policy) }),
  resetPolicies: ()      => req('/api/policies/reset', { method: 'POST' }),

  queue:    ()                                  => req('/api/queue'),
  review:   (id, reviewer, finalAction, notes)  =>
    req(`/api/queue/${id}/review`, { method: 'POST', body: JSON.stringify({ reviewer, finalAction, notes }) }),

  stats:    () => req('/api/stats'),
  feedback: () => req('/api/feedback'),
};
