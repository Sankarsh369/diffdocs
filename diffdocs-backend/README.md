# DiffDocs Core — Backend API

FastAPI service that ingests GitHub `git diff` payloads, sends them to Gemini for structured
analysis (features, bug fixes, refactors, breaking changes, risk level), and caches the result in
MongoDB so the same commit is never re-analyzed twice.

## Stack

- [FastAPI](https://fastapi.tiangolo.com) + [Uvicorn](https://www.uvicorn.org)
- [MongoDB Atlas](https://www.mongodb.com/atlas) via [Motor](https://motor.readthedocs.io) (async driver)
- [Google Gemini](https://ai.google.dev) (`google-genai`) with structured/schema-constrained output

## Getting started

```bash
python -m venv venv
venv\Scripts\activate        # Windows (use `source venv/bin/activate` on macOS/Linux)
pip install -r requirements.txt
copy .env.example .env       # `cp .env.example .env` on macOS/Linux, then fill in real values
python main.py
```

The API starts at `http://127.0.0.1:8000`. Interactive docs are at `/docs` (Swagger UI).

## Environment variables

| Variable         | Description                                                                 |
| ----------------- | ---------------------------------------------------------------------------- |
| `MONGO_URI`       | MongoDB Atlas (or any MongoDB) connection string                            |
| `GEMINI_API_KEY`  | API key for Google Gemini (`google-genai` SDK reads this)                   |
| `WEBHOOK_SECRET`  | Shared secret used to HMAC-sign/verify incoming webhook payloads            |
| `CORS_ORIGINS`    | Comma-separated list of allowed frontend origins (use `*` for local dev only)|

See [`.env.example`](.env.example). **Never commit your real `.env` file.**

## API

| Method | Path                | Description                                                            |
| ------ | ------------------- | ------------------------------------------------------------------------ |
| GET    | `/`                  | Health check                                                            |
| POST   | `/webhook/github`    | Manual/testing endpoint. HMAC-signed with `WEBHOOK_SECRET`; accepts `{repo_identifier, commit_sha, diff_content}` and returns the structured analysis directly |
| POST   | `/webhook/github-app`| Real GitHub App webhook receiver (see below) — verifies GitHub's own signature, fetches the diff via the GitHub API, and processes it in the background |
| GET    | `/api/telemetry`     | Returns the most recent 100 cached analyses, newest first, for the dashboard |

### Registering a real GitHub App (for `/webhook/github-app`)

Unlike the manual endpoint, a real GitHub App pushes its own event payloads (no diff content
included) and signs them with its own secret — the backend fetches the actual diff from the
GitHub API using a short-lived installation token. To wire this up:

1. Go to **[github.com/settings/apps/new](https://github.com/settings/apps/new)**.
2. Fill in:
   - **GitHub App name** — anything unique, e.g. `DiffDocs Intelligence` (this becomes the
     public slug used in the install URL).
   - **Homepage URL** — your deployed frontend, e.g. `https://diffdocs-frontend.vercel.app`.
   - **Webhook URL** — your deployed backend + `/webhook/github-app`, e.g.
     `https://diffdocs-backend.onrender.com/webhook/github-app`.
   - **Webhook secret** — generate a long random string and save it; this becomes
     `GITHUB_APP_WEBHOOK_SECRET`.
   - **Repository permissions** → Contents: *Read-only*, Pull requests: *Read-only* (Metadata
     read is included automatically).
   - **Subscribe to events** → check *Push* and *Pull request*.
   - **Where can this GitHub App be installed** → your choice (only your account is simplest).
3. Click **Create GitHub App**.
4. On the App's settings page, note the **App ID** → `GITHUB_APP_ID`.
5. Scroll to **Private keys** → **Generate a private key** → it downloads a `.pem` file. Paste
   its full contents (including the `-----BEGIN/END-----` lines) as `GITHUB_APP_PRIVATE_KEY`.
6. Note the App's slug from its public page URL (`github.com/apps/<slug>`) → set that as the
   frontend's `NEXT_PUBLIC_GITHUB_APP_SLUG` so the dashboard's install button links to it.
7. Add `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_APP_WEBHOOK_SECRET` to the
   backend's environment (locally in `.env`, or in your hosting provider's dashboard) and
   redeploy.
8. Install the App on a repo (via its `github.com/apps/<slug>/installations/new` page, or the
   dashboard button once step 6 is done) and push a commit — it should show up in
   `/api/telemetry` shortly after.

## Deploying

Deploys well to [Render](https://render.com) or [Railway](https://railway.app) as a Python web
service:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Set `MONGO_URI`, `GEMINI_API_KEY`, `WEBHOOK_SECRET`, and `CORS_ORIGINS` (your deployed
  frontend's URL) as environment variables in the platform's dashboard.

A ready-to-use [`render.yaml`](../render.yaml) blueprint is included at the repo root.
