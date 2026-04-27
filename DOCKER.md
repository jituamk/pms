# Running PMS with Docker

Everything you need to run the full stack locally is in `docker-compose.yml` at the repo root.

## What you get

| Service     | Image            | Port (host)         | Purpose                                                  |
| ----------- | ---------------- | ------------------- | -------------------------------------------------------- |
| `mysql`     | `mysql:8.0`      | `${DB_PORT_HOST:-3307}` | App database (utf8mb4)                                |
| `redis`     | `redis:7-alpine` | (internal)          | Cache, sessions, queue                                   |
| `backend`   | `pms-backend`    | `${BACKEND_PORT:-8000}` | Laravel API on Apache                                |
| `scheduler` | `pms-backend`    | (internal)          | `php artisan schedule:work` (monthly bills, audit purge) |
| `queue`     | `pms-backend`    | (internal)          | `php artisan queue:work` for queued jobs                 |
| `frontend`  | `pms-frontend`   | `${FRONTEND_PORT:-3000}` | Next.js standalone server                            |

## First run

```bash
cp .env.docker.example .env
docker compose up --build
```

The first boot will:

1. Wait for MySQL.
2. Generate and persist an `APP_KEY` to `storage/.app_key` inside the backend volume.
3. Run `php artisan migrate` and `db:seed` (creates `admin@pms.test` / `password`, `owner@pms.test` / `password`, demo building, flats, asset categories).

When you see `Server running at: http://0.0.0.0:8000`, open:

- Frontend → http://localhost:3000
- API base → http://localhost:8000/api
- MySQL    → 127.0.0.1:3307 user `pms` pass `pms` (or root / rootpms)

Subsequent `docker compose up` runs reuse the seeded data — the seeder only runs once (gated by `storage/app/.seeded`).

## Common commands

```bash
# Tail logs
docker compose logs -f backend
docker compose logs -f frontend

# Run an artisan command
docker compose exec backend php artisan tinker
docker compose exec backend php artisan migrate:status

# Re-seed (wipes & re-creates demo data)
docker compose exec backend php artisan migrate:fresh --seed

# Rebuild after Dockerfile or composer.json changes
docker compose build --no-cache backend
docker compose up -d backend

# Stop everything
docker compose down

# Stop & wipe volumes (database, app key, uploads — DESTRUCTIVE)
docker compose down -v
```

## Configuration

Edit `.env` at the repo root. Key knobs:

- `APP_DEBUG` — `false` in production.
- `BACKEND_PORT`, `FRONTEND_PORT`, `DB_PORT_HOST` — change if a host port is taken.
- `NEXT_PUBLIC_API_URL` — baked into the frontend bundle at **build time**. Change it and rebuild the `frontend` image.
- `SMS_PROVIDER` — `log` (default) or your gateway. With `log` the SMS body is written to `storage/logs/laravel.log`.

## Production tips

- Set `APP_ENV=production`, `APP_DEBUG=false`. The entrypoint will then run `config:cache`, `route:cache`, `view:cache`.
- Put a TLS-terminating reverse proxy (Caddy, nginx, Traefik) in front of `backend` and `frontend`.
- Mount the database and `backend-storage` volumes onto persistent disk.
- Schedule regular MySQL backups (`mysqldump`).
- Rotate `APP_KEY` only if you accept that previously-encrypted data (cookies, password reset tokens) is invalidated.

## Troubleshooting

- **Frontend can't reach backend** — make sure `NEXT_PUBLIC_API_URL` points to a host the browser can reach (default `http://localhost:8000/api`).
- **MySQL "Connection refused" on first boot** — the entrypoint waits up to 2 minutes; if it's still failing, check `docker compose logs mysql` for an init error.
- **403 / CSRF errors on login** — confirm `SANCTUM_STATEFUL_DOMAINS` includes your frontend host:port.
- **Composer/PHP changes not showing up** — rebuild: `docker compose build --no-cache backend && docker compose up -d backend`.
