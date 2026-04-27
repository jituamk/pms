# PMS Backend (Laravel)

REST API for the Property Management System.

## Initialize the Laravel project

This folder contains starter route + controller stubs. To turn it into a working Laravel app, generate a fresh Laravel 11 project here and copy the stubs in:

```bash
# from the repo root
composer create-project laravel/laravel backend-tmp
mv backend-tmp/* backend-tmp/.* backend/ 2>/dev/null || true
rm -rf backend-tmp

# install Sanctum for API auth
cd backend
composer require laravel/sanctum
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
php artisan migrate
```

Then merge the provided stubs:

- `routes/api.php` — login/logout/me routes
- `app/Http/Controllers/AuthController.php` — login handler

## Run

```bash
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

API runs at http://localhost:8000.

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Email + password login, returns Sanctum token |
| POST | `/api/auth/logout` | Revoke current token (auth required) |
| GET  | `/api/auth/me` | Current user (auth required) |
