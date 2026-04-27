#!/usr/bin/env bash
set -euo pipefail

# ---- Persisted APP_KEY (survives container restarts) -----------------------
# We persist a generated key in storage/.app_key (storage is a volume).
KEY_FILE=storage/.app_key
if [ -z "${APP_KEY:-}" ]; then
    if [ -s "${KEY_FILE}" ]; then
        export APP_KEY="$(cat ${KEY_FILE})"
        echo "[pms] Loaded persisted APP_KEY."
    else
        echo "[pms] Generating new APP_KEY…"
        APP_KEY="$(php -r 'echo "base64:".base64_encode(random_bytes(32));')"
        export APP_KEY
        echo "${APP_KEY}" > "${KEY_FILE}"
        chown www-data:www-data "${KEY_FILE}" 2>/dev/null || true
    fi
fi

# ---- Wait for MySQL ---------------------------------------------------------
DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USERNAME:-root}"
DB_PASS="${DB_PASSWORD:-}"

echo "[pms] Waiting for MySQL at ${DB_HOST}:${DB_PORT}…"
for i in $(seq 1 60); do
    if mysqladmin ping -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASS}" --silent 2>/dev/null; then
        echo "[pms] MySQL is up."
        break
    fi
    sleep 2
    if [ "$i" = 60 ]; then
        echo "[pms] MySQL did not become ready in time. Continuing anyway." >&2
    fi
done

# ---- Storage symlink + permissions -----------------------------------------
php artisan storage:link --no-interaction 2>/dev/null || true
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

# ---- Migrate (and seed once) -----------------------------------------------
if [ "${PMS_RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "[pms] Running migrations…"
    php artisan migrate --force --no-interaction || true

    if [ "${PMS_SEED_ON_FIRST_RUN:-true}" = "true" ] && [ ! -f storage/app/.seeded ]; then
        echo "[pms] First run: seeding database…"
        if php artisan db:seed --force --no-interaction; then
            touch storage/app/.seeded
            echo "[pms] Seed complete."
        else
            echo "[pms] Seed failed — continuing anyway." >&2
        fi
    fi
fi

# ---- Cache config in production --------------------------------------------
if [ "${APP_ENV:-local}" != "local" ]; then
    php artisan config:cache  || true
    php artisan route:cache   || true
    php artisan view:cache    || true
fi

# Forward to whichever command was passed (apache, queue worker, scheduler)
exec "$@"
