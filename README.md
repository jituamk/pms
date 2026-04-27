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

## Features (Phase 2)

- Per-room asset inventory across 5 categories (furniture, electronics, fixtures, kitchen, other)
- Auto-generated tenant acknowledgement bundle on lease activation
- Tenant checkbox + condition note per asset
- Move-out inspection with damage charges + extra deductions
- Automatic deposit refund calculation + deposit deduction ledger
- New views: /assets, /acknowledgements, /inspections

## Roadmap

- Phase 3: Utility billing, sub-meter allocation, SMS auto-verification
- Phase 4: Maintenance requests with photo + GPS check-in (3-day SLA)
- Phase 5: PDF reports, Bengali localization, advanced delegation
