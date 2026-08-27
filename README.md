# 🚀 DiffDocs — Automated Repository Intelligence

DiffDocs turns raw `git diff` output into structured, human-readable documentation. It reads a
commit's diff, sends it to Gemini for analysis, and returns a clean breakdown of what changed —
features, bug fixes, refactors, breaking changes, and an overall risk rating — so PR descriptions
and changelogs stop being a chore, and stakeholders can see exactly what shipped without reading
code.

👉 **Live demo:** [diffdocs-frontend.vercel.app](https://diffdocs-frontend.vercel.app) (dashboard, backed by a live API at [diffdocs-backend.onrender.com](https://diffdocs-backend.onrender.com))
👉 **Waitlist / landing page:** [Sankarsh369.github.io/diffdocs-waitlist](https://Sankarsh369.github.io/diffdocs-waitlist/)

> Note: the backend runs on Render's free tier, which spins down after periods of inactivity —
> the first request after a while may take ~30-60s to wake it up.

---

## How it works

```
GitHub push/PR ──▶ GitHub App webhook ──▶ diffdocs-backend ──fetch diff──▶ GitHub API
                                                 │
                                                 ▼
                                    Gemini (structured analysis)
                                                 │              │
                                                 ▼              ▼
                                     MongoDB Atlas (cache)   diffdocs-frontend dashboard
```

1. A real installed **GitHub App** (or, for manual testing, a hand-signed request) posts a
   webhook to the backend on every push/PR.
2. For the real App path, the backend authenticates as the App, exchanges that for an
   installation token, and fetches the actual unified diff from the GitHub API — GitHub's
   webhook payload itself never contains the diff.
3. The backend checks MongoDB for a cached analysis of that commit SHA. On a cache miss, it sends
   the diff to Gemini with a strict Pydantic response schema, so the model always returns
   well-formed structured output — not free-text.
4. The result is cached in MongoDB.
5. The dashboard (`diffdocs-frontend`) polls `/api/telemetry` and visualizes risk trends, team
   review load, and per-commit breakdowns.

See [`diffdocs-backend/README.md`](diffdocs-backend/README.md#registering-a-real-github-app-for-webhookgithub-app)
for how to register the GitHub App that drives step 1–2.

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

Deployed exactly as described below — the live demo above runs on this setup:

- **Backend** → [Render](https://render.com), via the [`render.yaml`](render.yaml) blueprint
- **Frontend** → [Vercel](https://vercel.com/new), root directory `diffdocs-frontend`,
  `NEXT_PUBLIC_API_URL` pointing at the Render service URL
- Render's `CORS_ORIGINS` env var is set to the exact Vercel URL (no trailing slash — CORS does
  literal origin matching)

See each app's README for exact build/start commands and required environment variables.

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
