# 🚀 DiffDocs — Automated Repository Intelligence

DiffDocs turns raw `git diff` output into structured, human-readable documentation. It reads a
commit's diff, sends it to Gemini for analysis, and returns a clean breakdown of what changed —
features, bug fixes, refactors, breaking changes, and an overall risk rating — so PR descriptions
and changelogs stop being a chore, and stakeholders can see exactly what shipped without reading
code.

👉 **Live demo:** _coming soon — see [Deployment](#deployment) below_
👉 **Waitlist / landing page:** [Sankarsh369.github.io/diffdocs-waitlist](https://Sankarsh369.github.io/diffdocs-waitlist/)

---

## How it works

```
GitHub commit/PR ──▶ webhook (git diff) ──▶ diffdocs-backend ──▶ Gemini (structured analysis)
                                                   │                        │
                                                   ▼                        ▼
                                          MongoDB Atlas (cache)   diffdocs-frontend dashboard
```

1. A signed webhook posts `{repo_identifier, commit_sha, diff_content}` to the backend.
2. The backend checks MongoDB for a cached analysis of that commit SHA. On a cache miss, it sends
   the diff to Gemini with a strict Pydantic response schema, so the model always returns
   well-formed structured output — not free-text.
3. The result is cached in MongoDB and returned to the caller.
4. The dashboard (`diffdocs-frontend`) polls `/api/telemetry` and visualizes risk trends, team
   review load, and per-commit breakdowns.

## Repository layout

| Path                 | What it is                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| [`index.html`](index.html), [`styles.css`](styles.css) | Static marketing/waitlist landing page (deployed via GitHub Pages) |
| [`diffdocs-backend/`](diffdocs-backend)  | FastAPI service: webhook ingestion, Gemini analysis, MongoDB caching |
| [`diffdocs-frontend/`](diffdocs-frontend) | Next.js dashboard that visualizes the analysis data |

Each app has its own README with setup details:
[backend](diffdocs-backend/README.md) · [frontend](diffdocs-frontend/README.md)

## Quickstart (local)

```bash
# 1. Backend
cd diffdocs-backend
python -m venv venv && venv\Scripts\activate   # source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
copy .env.example .env                          # cp on macOS/Linux — then fill in real values
python main.py                                  # http://127.0.0.1:8000

# 2. Frontend (new terminal)
cd diffdocs-frontend
npm install
copy .env.local.example .env.local              # cp on macOS/Linux
npm run dev                                      # http://localhost:3000
```

## Tech stack

- **Backend:** FastAPI, Uvicorn, MongoDB Atlas (Motor async driver), Google Gemini (`google-genai`)
- **Frontend:** Next.js (App Router, Turbopack), React 19, TypeScript, Tailwind CSS, Recharts
- **Landing page:** Semantic HTML5, custom CSS3, Loops.so for waitlist capture
- **Hosting:** GitHub Pages (landing page) · Render (backend) · Vercel (frontend)

## Deployment

The backend deploys to [Render](https://render.com) (blueprint at [`render.yaml`](render.yaml))
and the frontend to [Vercel](https://vercel.com/new). See each app's README for exact build/start
commands and required environment variables.

## Security notes

- `.env` files are git-ignored everywhere in this repo — only `.env.example` / `.env.local.example`
  templates are committed. Never commit real credentials.
- The webhook signing secret (`WEBHOOK_SECRET`) is used **only** server-side to verify incoming
  payloads via HMAC — it is never exposed to the frontend or rendered in the dashboard.
- Restrict `CORS_ORIGINS` on the backend to your actual deployed frontend URL in production.

## Roadmap

- **Context-aware historical analysis:** analyze past commits to understand the underlying *intent*
  behind code changes.
- **Multi-audience tuning:** toggle outputs between deep technical summaries for peer reviewers and
  high-level release notes for product managers.
- **Two-way project management sync:** automatically update matching tickets in Jira, Linear, or
  Notion.
