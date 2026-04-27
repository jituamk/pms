# PMS Frontend (Next.js)

The web UI for the Property Management System.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 — `/` redirects to `/login`.

## Pages

- `/login` — Sign-in form (POSTs to `${NEXT_PUBLIC_API_URL}/auth/login`)
- `/` — Redirects to `/login`

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api` | Laravel backend base URL |
