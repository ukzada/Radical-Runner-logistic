# Radical-Runner-Logistic

Dispatch management system built with Next.js, TypeScript, Prisma, and PostgreSQL (Neon).

## Features

- **Company > MC > Driver** hierarchy management
- **Load tracking** with full lifecycle
- **Role-based access** (Admin, Dispatcher)
- **JWT authentication** with refresh tokens
- **Password reset** flow (dispatcher requests, admin approves)
- **Audit logging** for sensitive operations
- **Rate limiting** on login and password reset
- **Real-time notifications** and **Dashboard** with KPIs

## Tech Stack

- Next.js (App Router) + TypeScript
- Prisma ORM + PostgreSQL (Neon)
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
```

```bash
npx prisma db push
npm run dev
```

Visit http://localhost:3000
