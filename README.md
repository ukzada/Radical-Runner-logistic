# Radical-Runner-Logistic

Dispatch management system built with Next.js, TypeScript, Prisma, and PostgreSQL.

## Features

- **Company > MC > Driver** hierarchy management
- **Load tracking** with full lifecycle
- **Role-based access** (Admin, Dispatcher, Company Owner)
- **Company Owner portal** — fleet KPIs, per-truck paid/pending earnings, CSV report export with dispatcher fee breakdown
- **Company Owners management** (admin) — dedicated section to create/update owner info, link owners to companies, fleet + earnings overview per owner
- **Dispatcher commission fees** by percentage, reflected in earnings and exports
- **Delivery-date reminders** — scheduled scans with in-app, toast, sound and browser notifications
- **JWT authentication** with refresh tokens
- **Password reset** flow (dispatcher requests, admin approves)
- **Audit logging** for sensitive operations
- **Rate limiting** on login and password reset
- **Dashboard** with KPIs and real-time notifications

## Tech Stack

- Next.js (App Router) + TypeScript
- Prisma ORM + PostgreSQL
- Tailwind CSS + shadcn/ui
- bcryptjs + Web Crypto API (JWT)

## Getting Started

```bash
npm install
```

Create `.env`:
```
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_random_256bit_hex
JWT_REFRESH_SECRET=another_random_256bit_hex
CRON_SECRET=random_secret_for_scheduler_endpoint
```

```bash
npx prisma db push
npm run dev
```

Visit http://localhost:3000

## Database Seeding (optional)

The application **does not use seed data** — a fresh deployment starts with an empty
database. The seed script lives in the repository (`prisma/seed.ts`) purely as an
optional helper for local development and demos, and is never executed automatically
by the app, the build, or the startup process.

To load the demo dataset (5 users, 3 companies, 7 MCs, 8 drivers, 19 loads):

```bash
npm run db:seed        # runs: npx tsx prisma/seed.ts
```

Demo accounts created by the seed:

| Role          | Email               | Password    | Notes                     |
| ------------- | ------------------- | ----------- | ------------------------- |
| Admin         | admin@rrl.com       | admin123    |                           |
| Dispatcher    | dispatcher1@rrl.com | dispatch123 | 10% commission            |
| Dispatcher    | dispatcher2@rrl.com | dispatch123 | 8% commission             |
| Dispatcher    | dispatcher3@rrl.com | dispatch123 | 12% commission            |
| Company Owner | owner@rrl.com       | owner123    | ABC Logistics             |

The seed script is idempotent: if `admin@rrl.com` already exists it skips gracefully.
