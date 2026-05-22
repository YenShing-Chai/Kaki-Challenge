# Steppa — Phase 1: Foundation

You are building a React Native (Expo) fitness app called **Steppa** — a loss-aversion
step challenge app where users stake real money on hitting their daily step goals.

## Your job for Phase 1: Foundation

Scaffold the full project with working auth, database schema, and navigation shell.
Everything should run locally and be production-architecture-ready.

---

## Tech Stack

- **Frontend:** React Native with Expo (SDK 52+), TypeScript, Expo Router (file-based routing)
- **Backend:** Node.js + Express, TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** Clerk (React Native SDK)
- **Env management:** dotenv

---

## What to build

### 1. Expo Frontend

Scaffold with `create-expo-app` using TypeScript template.

Install and configure:
- `expo-router` for navigation
- `@clerk/clerk-expo` for auth
- `react-native-safe-area-context`
- `@react-navigation/bottom-tabs`

Create the following screen files (stubs are fine, just proper layout + placeholder text):

```
app/
  _layout.tsx          — Root layout with ClerkProvider wrapping everything
  (auth)/
    _layout.tsx        — Auth group layout
    sign-in.tsx        — Sign in screen stub
    sign-up.tsx        — Sign up screen stub
  (tabs)/
    _layout.tsx        — Bottom tab navigator (4 tabs)
    index.tsx          — Home tab (placeholder: "Today's Challenge")
    squad.tsx          — Squad tab (placeholder: "Your Squad")
    history.tsx        — History tab (placeholder: "Past Challenges")
    profile.tsx        — Profile tab (placeholder: "Your Profile")
```

Auth flow logic:
- If user is not signed in → redirect to `(auth)/sign-in`
- If user is signed in → redirect to `(tabs)/index`
- Handle this in the root `_layout.tsx` using Clerk's `useAuth` hook

---

### 2. Express Backend

Create a `/server` directory in the same monorepo.

Structure:
```
server/
  src/
    index.ts           — Express app entry, PORT 3000
    routes/
      health.ts        — GET /health → { status: "ok" }
      users.ts         — POST /users/sync (called after Clerk signup to create DB record)
    middleware/
      requireAuth.ts   — Validates Clerk session token from Authorization header
    prisma/
      client.ts        — Prisma client singleton
  prisma/
    schema.prisma      — Full DB schema (see below)
  .env.example
  tsconfig.json
  package.json
```

---

### 3. Prisma Schema

Create this exact schema in `server/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                String       @id @default(uuid())
  clerkId           String       @unique
  email             String       @unique
  name              String?
  stripeCustomerId  String?
  timezone          String       @default("Asia/Kuala_Lumpur")
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  challenges        Challenge[]
  stepLogs          StepLog[]
  squadMemberships  SquadMember[]
  transactions      Transaction[]
}

model Challenge {
  id            String          @id @default(uuid())
  userId        String
  user          User            @relation(fields: [userId], references: [id])
  date          DateTime        @db.Date
  goalSteps     Int             @default(10000)
  stakeAmount   Decimal         @db.Decimal(10, 2)
  stepsAchieved Int             @default(0)
  status        ChallengeStatus @default(ACTIVE)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@unique([userId, date])
}

model StepLog {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  date       DateTime @db.Date
  stepsCount Int
  syncedAt   DateTime @default(now())

  @@unique([userId, date])
}

model Squad {
  id         String        @id @default(uuid())
  name       String
  inviteCode String        @unique @default(cuid())
  createdBy  String
  createdAt  DateTime      @default(now())

  members    SquadMember[]
}

model SquadMember {
  squadId  String
  squad    Squad    @relation(fields: [squadId], references: [id])
  userId   String
  user     User     @relation(fields: [userId], references: [id])
  joinedAt DateTime @default(now())

  @@id([squadId, userId])
}

model Transaction {
  id                    String          @id @default(uuid())
  userId                String
  user                  User            @relation(fields: [userId], references: [id])
  type                  TransactionType
  amount                Decimal         @db.Decimal(10, 2)
  stripePaymentIntentId String?
  createdAt             DateTime        @default(now())
}

enum ChallengeStatus {
  ACTIVE
  COMPLETED
  FORFEITED
}

enum TransactionType {
  HOLD
  RELEASE
  FORFEIT
}
```

---

### 4. Monorepo root

Create a root `package.json` with workspaces:
```json
{
  "name": "steppa",
  "private": true,
  "workspaces": ["app", "server"]
}
```

Create a root `README.md` with:
- Project overview
- Local setup instructions (env vars needed, how to run app + server)
- Phase 1 completion checklist

---

## Environment variables needed

### app/.env
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

### server/.env
```
DATABASE_URL=postgresql://localhost:5432/steppa
CLERK_SECRET_KEY=
PORT=3000
```

---

## Definition of done for Phase 1

- [ ] `cd app && npx expo start` launches the app with no errors
- [ ] Unauthenticated users land on sign-in screen
- [ ] Sign up / sign in via Clerk works on iOS simulator and Android emulator
- [ ] Authenticated users see the 4-tab shell
- [ ] `cd server && npm run dev` starts Express on port 3000
- [ ] `GET /health` returns `{ status: "ok" }`
- [ ] `npx prisma migrate dev` runs cleanly against local PostgreSQL
- [ ] All TypeScript compiles with no errors

---

## Notes

- Use TypeScript strictly throughout, no `any` types
- Add a `.gitignore` that covers `node_modules`, `.env`, `ios/`, `android/`, `.expo/`
- Do not build any real UI yet — clean stubs only, Phase 2 handles the core mechanic
- Comment any non-obvious logic
