# Property Management System (PMS)

A production-grade Property Management System for property owners in Dhaka, Bangladesh.

## Stack

- **Frontend:** Next.js 14 (PWA, App Router, TypeScript, Tailwind)
- **Backend:** Laravel 11 (PHP 8.2+, Sanctum auth)
- **Database:** MySQL 8
- **Push:** Firebase Cloud Messaging (FCM)
- **Storage:** Local disk (Bangladesh hosting)

## Roles

Super_Admin · Owner · Delegate · Caretaker · Accountant · Tenant

## Quick start

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve --port=8000
```

Default super-admin: `admin@pms.test` / `password`

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000 — installable as PWA on Android.

## Features (Phase 1)

- Owner self-signup with phone OTP + NID upload
- Tenant invite via SMS temp password
- Building → Floor → Flat → Room hierarchy
- Tenants & Leases
- Rent policies (3 late-fee methods)
- Payment recording + proof upload + manual verification
- 6 role-based dashboards
- Audit log (5-year retention)
- PWA offline queue
- FCM push notifications scaffold

## Roadmap

- Phase 2: Asset catalog, audit, notice/vacating, settlement
- Phase 3: Utility billing, sub-meter allocation, SMS auto-verification
- Phase 4: Reports, Bengali localization, advanced delegation
