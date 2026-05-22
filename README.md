# Do-and-Earn

Do the work. Earn the pot.

Prize pool fitness challenges. Pay to join, walk every day, split the pot.

A React Native (Expo) app where users commit money to public step challenges. Hit your goal every day → split the prize pool. Miss any day → eliminated, your stake stays in the pool.

## Monorepo layout

```
.
├── app/                Expo React Native client (TypeScript, Expo Router, Clerk)
├── server/             Express API (TypeScript, Prisma, Neon Postgres)
├── fitness-app-2/      Phase prompt pack (v2 spec — prize pool model)
└── app-fitness/        Legacy phase pack (v1, individual stake model — kept for reference)
```

## Local setup

### Prerequisites

- Node 20+
- Existing accounts: [Clerk](https://clerk.com), [Stripe](https://stripe.com), [Neon](https://neon.tech)
- Xcode (iOS simulator) and/or Android Studio (emulator), or Expo Go on a phone

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy the examples and fill in:

```bash
cp app/.env.example app/.env
cp server/.env.example server/.env
```

**`app/.env`**
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk dashboard
- `EXPO_PUBLIC_API_URL` — defaults to `http://localhost:3456`

**`server/.env`**
- `DATABASE_URL` — Neon **pooled** connection string (runtime)
- `DIRECT_URL` — Neon **direct** connection string (Prisma migrations)
- `CLERK_SECRET_KEY` — Clerk dashboard
- `STRIPE_SECRET_KEY` — Stripe dashboard
- `PORT` — defaults to `3456` (port 3000 conflicts with another local service)

### 3. Database

Run the initial migration:

```bash
cd server
npx prisma migrate dev --name init
```

### 4. Run

```bash
npm run server   # Express on :3456
npm run app      # Expo Metro on :8081
```

## Phase 1 — Done when

- [ ] `npm run app` launches Expo with no errors
- [ ] Unauthenticated users land on sign-in
- [ ] Clerk sign-up / sign-in reaches the 4-tab shell (Home / Discover / Activity / Profile)
- [ ] `npm run server` starts Express on :3456
- [ ] `GET /health` returns `{ "status": "ok", "db": "connected" }`
- [ ] `npx prisma migrate dev` runs cleanly against Neon
- [ ] `tsc --noEmit` clean on both app and server

See `fitness-app-2/phase-1-foundation.md` for the full spec.
