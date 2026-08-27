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

| Method | Path              | Description                                                            |
| ------ | ----------------- | ------------------------------------------------------------------------ |
| GET    | `/`                | Health check                                                            |
| POST   | `/webhook/github`  | HMAC-signed endpoint that accepts `{repo_identifier, commit_sha, diff_content}`, returns the structured analysis |
| GET    | `/api/telemetry`   | Returns the most recent 100 cached analyses, newest first, for the dashboard |

## Deploying

Deploys well to [Render](https://render.com) or [Railway](https://railway.app) as a Python web
service:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Set `MONGO_URI`, `GEMINI_API_KEY`, `WEBHOOK_SECRET`, and `CORS_ORIGINS` (your deployed
  frontend's URL) as environment variables in the platform's dashboard.

A ready-to-use [`render.yaml`](../render.yaml) blueprint is included at the repo root.
