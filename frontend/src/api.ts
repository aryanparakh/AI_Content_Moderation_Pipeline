import type {
  CategoryMeta,
  FeedbackExample,
  ModerationContext,
  ModerationDecision,
  ModerationRecord,
  PlatformPolicy,
  Stats,
  Action,
} from "./types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export interface Health {
  ok: boolean;
  model: string;
  apiKeyConfigured: boolean;
  thinking: boolean;
}

export const api = {
  health: () => req<Health>("/api/health"),
  categories: () => req<CategoryMeta[]>("/api/categories"),
  policies: () => req<PlatformPolicy[]>("/api/policies"),
  savePolicy: (p: PlatformPolicy) =>
    req<PlatformPolicy>(`/api/policies/${p.id}`, { method: "PUT", body: JSON.stringify(p) }),
  resetPolicies: () => req<PlatformPolicy[]>("/api/policies/reset", { method: "POST" }),

  moderate: (content: string, context: ModerationContext) =>
    req<ModerationRecord>("/api/moderate", {
      method: "POST",
      body: JSON.stringify({ content, context }),
    }),
  previewPolicy: (recordId: string, platformId: string) =>
    req<{ decision: ModerationDecision; policyRef: { id: string; name: string } }>(
      "/api/preview-policy",
      { method: "POST", body: JSON.stringify({ recordId, platformId }) }
    ),

  queue: () => req<ModerationRecord[]>("/api/queue"),
  records: () => req<ModerationRecord[]>("/api/records"),
  review: (id: string, reviewer: string, finalAction: Action, notes?: string) =>
    req<ModerationRecord>(`/api/queue/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ reviewer, finalAction, notes }),
    }),
  feedback: () => req<FeedbackExample[]>("/api/feedback"),
  stats: () => req<Stats>("/api/stats"),
};
