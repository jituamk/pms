# PMS — Property Management System

A full-stack Property Management System.

- **Frontend:** [Next.js 14](https://nextjs.org/) (App Router) + TypeScript + Tailwind CSS
- **Backend:** [Laravel](https://laravel.com/) (REST API)

## Repository structure

```
pms/
├── frontend/   # Next.js application (UI + client-side routing)
└── backend/    # Laravel application (REST API + auth)
```

## Getting started

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000 — you will be redirected to `/login`.

### Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

The API will be available at http://localhost:8000.

## Roadmap

- [x] Login page (frontend)
- [ ] Login API (backend) with Laravel Sanctum
- [ ] Dashboard
- [ ] Properties CRUD
- [ ] Tenants CRUD
- [ ] Leases & payments
- [ ] Maintenance requests

## License

MIT
