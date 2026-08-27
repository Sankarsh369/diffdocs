# DiffDocs Core — Dashboard

The Next.js frontend for DiffDocs: a dashboard that visualizes AI-generated documentation and
risk analysis produced by [`diffdocs-backend`](../diffdocs-backend) for every incoming code diff.

## Stack

- [Next.js](https://nextjs.org) (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS
- [Recharts](https://recharts.org) for the risk/complexity charts
- [lucide-react](https://lucide.dev) for icons

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then point NEXT_PUBLIC_API_URL at your backend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). By default it talks to a backend running
locally at `http://127.0.0.1:8000` — start [`diffdocs-backend`](../diffdocs-backend) first, or
point `NEXT_PUBLIC_API_URL` at a deployed instance.

## Environment variables

| Variable                      | Description                                              |
| ------------------------------ | --------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`          | Base URL of the `diffdocs-backend` API (no trailing slash) |
| `NEXT_PUBLIC_GITHUB_APP_SLUG`  | Slug of your registered GitHub App; enables the "Install GitHub Application" button. See [backend README](../diffdocs-backend/README.md#registering-a-real-github-app-for-webhookgithub-app) |

See [`.env.local.example`](.env.local.example).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — lint the project

## Deploying

This app deploys cleanly to [Vercel](https://vercel.com/new): import the repo, set the project's
root directory to `diffdocs-frontend`, add the `NEXT_PUBLIC_API_URL` environment variable pointing
at your deployed backend, and deploy.
