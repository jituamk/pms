# PMS Backend (Laravel 11)

REST API for the Property Management System.

## Setup

```bash
cp .env.example .env
composer install
php artisan key:generate

# SQLite (default in .env.example)
touch database/database.sqlite

php artisan migrate --seed
php artisan serve
```

API runs at http://localhost:8000.

A seeded admin user is created:

- **Email:** `admin@pms.test`
- **Password:** `password`

## Endpoints

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No  | Create user, returns Sanctum token |
| POST | `/api/auth/login`    | No  | Login, returns Sanctum token |
| POST | `/api/auth/logout`   | Yes | Revoke current token |
| GET  | `/api/auth/me`       | Yes | Current user |

### Properties (`/api/properties`)
Full REST resource: `index`, `store`, `show`, `update`, `destroy`.

### Tenants (`/api/tenants`)
Full REST resource: `index`, `store`, `show`, `update`, `destroy`.

All resource routes require `Authorization: Bearer <token>`.

## Stack

- Laravel 11
- Sanctum (token-based API auth)
- SQLite by default (switchable in `.env`)
