# 🛡️ AI-Powered Content Moderation Pipeline

Assignment 10 — Trust & Safety

A multi-stage content moderation pipeline:

**Automated Classification → Context-Aware Analysis → Confidence-Based Routing → Explainable Decisions → Human Review Queue → Per-Platform Policy Configuration**

Built with a **TypeScript / Node (Express)** backend and a **React (Vite)** frontend. Classification uses the **Claude API** (`claude-opus-4-8`) with structured outputs and adaptive thinking.

---

## How the Pipeline Works

```text
            ┌──────────────────────────────────────────────────────────────┐
content ──▶ │ 1. CLASSIFIER (Claude)                                        │
+ context   │    multi-category + per-category confidence + offending span  │
            │    judged IN CONTEXT (platform, author history, thread)       │
            └───────────────┬──────────────────────────────────────────────┘
                            ▼
            ┌──────────────────────────────────────────────────────────────┐
            │ 2. POLICY ENGINE (deterministic, per-platform)                │
            │    category toggles · review threshold · auto-block threshold │
            │    · custom keyword rules                                     │
            └───────────────┬──────────────────────────────────────────────┘
                            ▼
            ┌──────────────────────────────────────────────────────────────┐
            │ 3. CONFIDENCE ROUTER                                          │
            │   conf ≥ auto-block → AUTO-BLOCK                              │
            │   review ≤ conf < block → HUMAN REVIEW QUEUE                  │
            │   conf < review → AUTO-ALLOW                                  │
            └───────────────┬──────────────────────────────────────────────┘
                            ▼
       explainable decision (segment + category + reasoning + threshold)
                            ▼
            human reviewer overrides → captured as labelled feedback
```

The classifier is the **only model call**. Everything downstream—policy application, routing, explanation, and aggregation—is **pure deterministic code**, making moderation behavior instant, predictable, and testable.

---

## Harm Categories

- `hate_speech`
- `harassment`
- `spam`
- `misinformation`
- `graphic_violence`
- `adult_content`
- `self_harm`

---

## Prerequisites

- Node.js 20+
- Anthropic API key

---

## Setup & Run

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend URL:

```text
http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

---

## Environment Variables

| Key | Default | Purpose |
|------|---------|----------|
| `ANTHROPIC_API_KEY` | — | Required Anthropic API key |
| `PORT` | `4000` | Backend port |
| `MODERATION_MODEL` | `claude-opus-4-8` | Moderation model |
| `MODERATION_THINKING` | `true` | Enables adaptive reasoning |

---

## Project Structure

```text
backend/
  src/
    types.ts
    config/
      policies.ts
    moderation/
      classifier.ts
      policyEngine.ts
      pipeline.ts
    store/
      store.ts
    routes/
    eval/
    index.ts

frontend/
  src/
    api.ts
    components/
      Moderate.tsx
      ReviewQueue.tsx
      Policies.tsx
    App.tsx
```

---

## API Reference

| Method | Endpoint | Description |
|----------|----------|-------------|
| GET | `/api/health` | Service health |
| GET | `/api/categories` | Harm categories |
| POST | `/api/moderate` | Run moderation |
| GET | `/api/queue` | Human review queue |
| GET | `/api/records` | Audit records |
| GET | `/api/stats` | Dashboard stats |
| GET/PUT | `/api/policies/:id` | Read/update policies |

---

## Automated Evaluation

```bash
cd backend
npm run evaluate
```

Checks:

- Classification accuracy
- Context awareness
- Routing logic
- Explainability
- Policy differences

---

## Notes

- Storage is currently in-memory.
- Policy changes take effect instantly.
- Reviewer overrides are stored as feedback examples.
- Designed as a Trust & Safety demonstration project.

---

## License

Educational / Portfolio Project.
