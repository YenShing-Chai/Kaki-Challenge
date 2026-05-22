# Steppa — Phase 1: Foundation (Pivoted Spec)

You are building a React Native (Expo) fitness app called **Steppa** — a prize pool
step challenge app. Users pay a commitment fee to join public challenges. Everyone
who completes the step goal every day splits the prize pool. Those who fail lose
their commitment fee to the winners.

**Core mechanic (from screenshots):**
- A challenge has: commitment fee, participant count, daily step goal, duration (days)
- Prize pool = commitment fee × all participants
- Complete every day of the challenge → qualify to split the prize pool
- Miss any day → you're eliminated, your money stays in the pool for winners

---

## Infrastructure (Already created — do not recreate)

- **Auth:** Clerk (already set up — use existing publishable + secret keys)
- **Database:** Neon PostgreSQL (already provisioned — use existing `DATABASE_URL`)
- **Payments:** Stripe (already set up — use existing keys)

---

## Tech Stack

- **Frontend:** React Native with Expo (SDK 52+), TypeScript, Expo Router (file-based routing)
- **Backend:** Node.js + Express, TypeScript
- **Database:** Neon PostgreSQL via Prisma ORM
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

Create the following screen files (stubs with placeholder text only):

```
app/
  _layout.tsx              — Root layout with ClerkProvider wrapping everything
  (auth)/
    _layout.tsx            — Auth group layout
    sign-in.tsx            — Sign in screen stub
    sign-up.tsx            — Sign up screen stub
  (tabs)/
    _layout.tsx            — Bottom tab navigator (4 tabs)
    index.tsx              — Home: "Active Challenges"
    discover.tsx           — Discover: "Browse Challenges"
    activity.tsx           — Activity: "Your History"
    profile.tsx            — Profile: "Your Profile"
```

Auth flow:
- Not signed in → `(auth)/sign-in`
- Signed in, no onboarding → `(auth)/onboarding`
- Signed in, onboarded → `(tabs)/index`
- Handle in root `_layout.tsx` via Clerk `useAuth` hook

---

### 2. Express Backend

Create `/server` directory.

Structure:
```
server/
  src/
    index.ts
    routes/
      health.ts
      users.ts
      challenges.ts        — stub only in Phase 1
      steps.ts             — stub only in Phase 1
    middleware/
      requireAuth.ts       — validates Clerk JWT from Authorization header
    lib/
      prisma.ts            — Prisma client singleton
  prisma/
    schema.prisma
  .env.example
  tsconfig.json
  package.json
```

---

### 3. Prisma Schema

Create this schema in `server/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─── Users ───────────────────────────────────────────────────────────────────

model User {
  id                     String   @id @default(uuid())
  clerkId                String   @unique
  email                  String   @unique
  name                   String?
  avatarUrl              String?
  stripeCustomerId       String?
  stripePaymentMethodId  String?  // saved card for future charges
  timezone               String   @default("Asia/Kuala_Lumpur")
  expoPushToken          String?
  hasCompletedOnboarding Boolean  @default(false)
  currentStreak          Int      @default(0)
  longestStreak          Int      @default(0)
  totalWon               Decimal  @default(0) @db.Decimal(10, 2)
  totalLost              Decimal  @default(0) @db.Decimal(10, 2)
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  participations ChallengeParticipant[]
  stepLogs       StepLog[]
  transactions   Transaction[]
  createdChallenges Challenge[]
}

// ─── Challenges ───────────────────────────────────────────────────────────────

model Challenge {
  id               String          @id @default(uuid())
  title            String          // e.g. "Cash Club"
  description      String?
  createdById      String
  createdBy        User            @relation(fields: [createdById], references: [id])
  isPublic         Boolean         @default(true)
  commitmentFee    Decimal         @db.Decimal(10, 2)  // e.g. 20.00
  dailyStepGoal    Int             @default(10000)
  durationDays     Int             // e.g. 5
  startDate        DateTime        @db.Date
  endDate          DateTime        @db.Date            // computed: startDate + durationDays
  status           ChallengeStatus @default(OPEN)      // OPEN → ACTIVE → COMPLETED
  prizePool        Decimal         @default(0) @db.Decimal(10, 2)  // grows as people join
  maxParticipants  Int?            // null = unlimited
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  participants ChallengeParticipant[]
}

// ─── Participants ─────────────────────────────────────────────────────────────

model ChallengeParticipant {
  id              String              @id @default(uuid())
  challengeId     String
  challenge       Challenge           @relation(fields: [challengeId], references: [id])
  userId          String
  user            User                @relation(fields: [userId], references: [id])
  status          ParticipantStatus   @default(ACTIVE)  // ACTIVE → QUALIFIED | ELIMINATED
  commitmentPaid  Decimal             @db.Decimal(10, 2)
  joinedAt        DateTime            @default(now())

  // Stripe payment intent created when joining (held, not captured)
  stripePaymentIntentId String?

  dailyProgress DailyProgress[]

  @@unique([challengeId, userId])
}

// ─── Daily Progress ───────────────────────────────────────────────────────────

model DailyProgress {
  id             String               @id @default(uuid())
  participantId  String
  participant    ChallengeParticipant @relation(fields: [participantId], references: [id])
  date           DateTime             @db.Date
  stepsAchieved  Int                  @default(0)
  goalSteps      Int                  // snapshot of challenge dailyStepGoal
  completed      Boolean              @default(false)  // stepsAchieved >= goalSteps
  syncedAt       DateTime             @default(now())

  @@unique([participantId, date])
}

// ─── Step Logs ────────────────────────────────────────────────────────────────

model StepLog {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  date       DateTime @db.Date
  stepsCount Int
  syncedAt   DateTime @default(now())

  @@unique([userId, date])
}

// ─── Transactions ─────────────────────────────────────────────────────────────

model Transaction {
  id                    String          @id @default(uuid())
  userId                String
  user                  User            @relation(fields: [userId], references: [id])
  type                  TransactionType
  amount                Decimal         @db.Decimal(10, 2)
  description           String?
  stripePaymentIntentId String?
  createdAt             DateTime        @default(now())
}

// ─── Enums ────────────────────────────────────────────────────────────────────

enum ChallengeStatus {
  OPEN       // accepting participants
  ACTIVE     // challenge has started, no new joiners
  COMPLETED  // all days resolved, prizes distributed
  CANCELLED  // not enough participants, all refunded
}

enum ParticipantStatus {
  ACTIVE      // still in the challenge
  QUALIFIED   // completed all days, will receive prize
  ELIMINATED  // missed a day, commitment forfeited
}

enum TransactionType {
  COMMITMENT_HOLD     // card authorised when joining
  COMMITMENT_CAPTURE  // charged when eliminated / challenge ends
  PRIZE_PAYOUT        // received winnings
  REFUND              // cancelled challenge
}
```

Run: `npx prisma migrate dev --name init`

---

### 4. Monorepo root

Root `package.json`:
```json
{
  "name": "steppa",
  "private": true,
  "workspaces": ["app", "server"]
}
```

Root `README.md` with setup instructions and Phase 1 checklist.

---

## Environment variables

### app/.env
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=        # from your existing Clerk app
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### server/.env
```
DATABASE_URL=                             # Neon pooled connection string
DIRECT_URL=                              # Neon direct connection string (for migrations)
CLERK_SECRET_KEY=                         # from your existing Clerk app
STRIPE_SECRET_KEY=                        # from your existing Stripe account
PORT=3000
```

> Neon requires both `DATABASE_URL` (pooled, for runtime) and `DIRECT_URL`
> (direct, for Prisma migrations). Both are in your Neon dashboard.

---

## Definition of done for Phase 1

- [ ] `cd app && npx expo start` — no errors
- [ ] Unauthenticated users land on sign-in
- [ ] Clerk sign up / sign in works on simulator
- [ ] Authenticated users see 4-tab shell
- [ ] `cd server && npm run dev` — Express running on port 3000
- [ ] `GET /health` returns `{ status: "ok", db: "connected" }`
- [ ] `npx prisma migrate dev` runs cleanly against Neon
- [ ] All TypeScript compiles with no errors (`tsc --noEmit`)

---

## Notes

- Use TypeScript strictly, no `any`
- `.gitignore`: `node_modules`, `.env`, `ios/`, `android/`, `.expo/`
- Screen stubs only — no real UI until Phase 2
- The `DIRECT_URL` in Neon is separate from `DATABASE_URL` — do not mix them up
