# 🛡️ AI-Powered Content Moderation Pipeline

Assignment 10 — Trust & Safety. A multi-stage content-moderation pipeline:
**automated classification → context-aware analysis → confidence-based routing →
explainable decisions → human review queue → per-platform policy configuration.**

Built with a **TypeScript / Node (Express)** backend and a **React (Vite)**
frontend. Classification uses the **Claude API** (`claude-opus-4-8`) with
structured outputs and adaptive thinking.

---

## How the pipeline works

```
            ┌──────────────────────────────────────────────────────────────┐
content ──▶ │ 1. CLASSIFIER (Claude)                                        │
+ context   │    multi-category + per-category confidence + offending span   │
            │    judged IN CONTEXT (platform, author history, thread)        │
            └───────────────┬──────────────────────────────────────────────┘
                            ▼
            ┌──────────────────────────────────────────────────────────────┐
            │ 2. POLICY ENGINE (deterministic, per-platform)                 │
            │    category toggles · review threshold · auto-block threshold  │
            │    · custom keyword rules                                      │
            └───────────────┬──────────────────────────────────────────────┘
                            ▼
            ┌──────────────────────────────────────────────────────────────┐
            │ 3. CONFIDENCE ROUTER                                           │
            │   conf ≥ auto-block → AUTO-BLOCK                               │
            │   review ≤ conf < block → HUMAN REVIEW QUEUE                   │
            │   conf < review → AUTO-ALLOW                                   │
            └───────────────┬──────────────────────────────────────────────┘
                            ▼
       explainable decision (segment + category + reasoning + which threshold fired)
                            ▼
            human reviewer overrides → captured as labelled feedback
```

The classifier is the *only* model call. Everything downstream — policy
application, routing, explanation, aggregation — is **pure, deterministic
code**, which is what makes "change a threshold, change the behaviour" instant,
free, and testable.

The seven harm categories: `hate_speech`, `harassment`, `spam`,
`misinformation`, `graphic_violence`, `adult_content`, `self_harm`.

---

## Prerequisites

- Node.js 20+ (developed on Node 24)
- An Anthropic API key — get one at <https://console.anthropic.com/>

---

## Setup & run

Two terminals.

### 1. Backend (API)

```bash
cd backend
npm install
cp .env.example .env        # then edit .env and paste your ANTHROPIC_API_KEY
npm run dev                 # http://localhost:4000
```

`.env` keys:

| Key | Default | Purpose |
|-----|---------|---------|
| `ANTHROPIC_API_KEY` | — | **Required.** Your Claude API key. |
| `PORT` | `4000` | API port. |
| `MODERATION_MODEL` | `claude-opus-4-8` | Classifier model. |
| `MODERATION_THINKING` | `true` | Adaptive thinking on the classifier (`false` = faster/cheaper). |

### 2. Frontend (UI)

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173  (proxies /api → :4000)
```

Open <http://localhost:5173>.

---

## Using the app

- **Moderate** — paste content, pick a platform, optionally add context
  (surface + author history), and submit. You get the routing decision, the
  aggregate action, per-category confidence bars, the **highlighted offending
  segment**, and the model's context reasoning. Quick-load buttons demo the
  context and spam/misinfo cases.
- **Review queue** — items routed to human review, with full context, the AI's
  reasoning, and Allow / Review / Block buttons. Choosing anything other than
  the AI's recommendation is recorded as an **override** and captured as
  labelled feedback. Live counters at the top (incl. AI/human agreement rate).
- **Policies** — per-platform configuration. Toggle categories, drag the
  review / auto-block threshold sliders, and add custom keyword rules. Compare
  the shipped **Children's Platform (strict)** vs **Adult / Mature Community**
  to see identical content decided differently.

---

## Automated evaluation (success metrics)

A labelled test set + harness runs the **real** pipeline and checks every
success metric:

```bash
cd backend
npm run evaluate            # needs ANTHROPIC_API_KEY in .env
```

It reports pass/fail for:

| Success metric | How it's checked |
|----------------|------------------|
| **Classification identifies all harm categories** | Labelled examples across all 7 categories + clean controls; asserts expected categories are detected and clean content isn't flagged. |
| **Context-aware analysis** | The *same* sentence (`"I'm going to kill you…"`) in friendly-banter vs. credible-threat context must produce **different** actions. |
| **Routing logic** | Clear violations → `auto_block`; clean → `auto_allow`; ambiguous → `human_review`. |
| **Explainability** | Every flag must cite a **verbatim** offending segment found in the content. |
| **Policy configuration** | Identical explicit content is **allowed** on the adult platform and **blocked** on the children's platform — pure policy difference. |

---

## Project layout

```
backend/
  src/
    types.ts                 shared domain types
    config/policies.ts       default per-platform policies (general / kids / adult)
    moderation/
      classifier.ts          Claude call, structured output, context-aware prompt
      policyEngine.ts        thresholds + custom rules → explainable decision
      pipeline.ts            classify → policy → route → persist
    store/store.ts           in-memory records / queue / policies / feedback
    routes/                  moderate, queue, policies REST endpoints
    eval/                    labelled test set + evaluation harness
    index.ts                 Express server
frontend/
  src/
    api.ts                   typed API client
    components/              Moderate, ReviewQueue, Policies, shared UI
    App.tsx                  tabbed shell + health banner
```

## API reference (backend)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Status + whether an API key is configured. |
| `GET` | `/api/categories` | Harm category ids + labels. |
| `POST` | `/api/moderate` | Run content through the pipeline. |
| `POST` | `/api/preview-policy` | Re-apply a policy to an existing record (no model call). |
| `GET` | `/api/queue` | Items pending human review. |
| `GET` | `/api/records` / `/api/records/:id` | Full audit log. |
| `POST` | `/api/queue/:id/review` | Submit a reviewer verdict. |
| `GET` | `/api/feedback` | Reviewer decisions as labelled examples. |
| `GET` | `/api/stats` | Dashboard counters. |
| `GET/PUT` | `/api/policies[/:id]` | Read / update platform policies. |
| `POST` | `/api/policies/reset` | Restore shipped defaults. |

---

## Notes & limitations

- **Storage is in-memory** — records and policy edits reset when the API
  restarts. Swapping in SQLite/Postgres means reimplementing `store/store.ts`
  only. Kept in-memory deliberately for a dependency-free, resettable demo.
- **Reviewer feedback** is captured as labelled `(content, context, ai_action,
  human_action)` examples (`GET /api/feedback`). These are the raw material for
  improving the model — e.g. as few-shot exemplars or a fine-tuning set.
- `npm audit` flags the esbuild/Vite dev-server advisory (dev-only, fixing it
  is a major-version bump); it does not affect the built app or the backend.
