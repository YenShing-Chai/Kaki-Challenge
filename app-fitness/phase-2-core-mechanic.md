# Steppa — Phase 2: Core Mechanic

Phase 1 is complete. The project is scaffolded with Expo + Clerk auth + Express + Prisma.

## Your job for Phase 2: Core Mechanic

Build the three pillars of the app: money staking via Stripe, step syncing from the
device health API, and the daily challenge lifecycle with a midnight cron reset.

---

## 1. Stripe Payment Hold & Release

### Backend — new routes in `server/src/routes/payments.ts`

#### `POST /payments/setup-intent`
- Creates a Stripe SetupIntent for saving a card on file
- Returns `{ clientSecret }`

#### `POST /challenges/start`
- Authenticated route (use `requireAuth` middleware)
- Body: `{ date, goalSteps, stakeAmount }`
- Steps:
  1. Look up user's `stripeCustomerId`
  2. Create a Stripe PaymentIntent with `capture_method: "manual"` (authorise only, don't charge yet)
  3. Confirm the PaymentIntent against the saved payment method
  4. Create a `Challenge` record in DB with `status: ACTIVE`
  5. Create a `Transaction` record with `type: HOLD`
  6. Return `{ challengeId, status: "active" }`

#### `POST /challenges/:id/complete`
- Called by the cron job (internal, verify with a shared `CRON_SECRET` header)
- If `stepsAchieved >= goalSteps` → cancel the PaymentIntent (no charge), set `status: COMPLETED`, create `Transaction` with `type: RELEASE`
- If `stepsAchieved < goalSteps` → capture the PaymentIntent (charge the user), set `status: FORFEITED`, create `Transaction` with `type: FORFEIT`

---

## 2. Step Syncing

### Frontend — `app/lib/health.ts`

Create a unified health module that abstracts platform differences:

```typescript
export async function requestHealthPermissions(): Promise<boolean>
export async function getTodaySteps(): Promise<number>
```

Platform implementations:
- **iOS:** Use `expo-health` to read `HKQuantityTypeIdentifierStepCount` for today
- **Android:** Use `@react-native-google-signin/google-signin` + Google Fit REST API
  - Scope: `https://www.googleapis.com/auth/fitness.activity.read`
  - Read `derived:com.google.step_count.delta` aggregate for today

### Backend — `POST /steps/sync`

- Authenticated route
- Body: `{ date, stepsCount }`
- Upserts a `StepLog` record for that user + date
- Also updates `stepsAchieved` on the active `Challenge` for that date if one exists
- Returns `{ stepsCount, challengeStatus }`

### Frontend — sync schedule

In `app/(tabs)/index.tsx`, set up a background sync:
- Sync immediately on app foreground (`AppState` change)
- Sync every 15 minutes while app is open (`setInterval`)
- After each sync, call `POST /steps/sync` with the latest count

---

## 3. Daily Challenge Reset Cron

### Backend — `server/src/jobs/midnightReset.ts`

Use `node-cron` to schedule a job that runs at `23:59` in each user's local timezone.

Logic:
1. Query all `Challenge` records where `date = today` and `status = ACTIVE`
2. For each challenge, fetch the latest `StepLog` for that user and date
3. Call the complete/forfeit logic (same as `POST /challenges/:id/complete`)
4. Log outcome: `[CRON] userId=xxx date=xxx steps=xxx/xxx → COMPLETED | FORFEITED`

Timezone handling:
- Store user timezone in the `User` table (already in schema as `timezone`)
- Run the cron every minute, check which users have hit 23:59 in their local timezone

---

## 4. Home Screen — `app/(tabs)/index.tsx`

Build the real Home screen (logic only, no final styling — that's Phase 4):

Components to render:
- **StepRing** — circular progress showing `stepsAchieved / goalSteps` as a percentage
- **StakeDisplay** — shows "💸 $30 at risk" or "✅ Safe" depending on progress
- **Countdown** — time remaining until midnight in user's timezone
- **SyncButton** — manual refresh button that calls `getTodaySteps()` then `POST /steps/sync`

State to manage:
```typescript
{
  todayChallenge: Challenge | null
  currentSteps: number
  isSyncing: boolean
  timeUntilMidnight: string   // e.g. "3h 42m"
}
```

On mount:
1. Fetch today's active challenge from `GET /challenges/today`
2. Fetch current steps from device health API
3. Start 60s interval to update `timeUntilMidnight`

---

## 5. New Backend Routes needed

#### `GET /challenges/today`
- Returns the authenticated user's challenge for today
- If none exists, returns `{ challenge: null }`

#### `GET /challenges/history`
- Returns last 30 days of challenges for the user
- Include `stepsAchieved`, `goalSteps`, `stakeAmount`, `status`

---

## Environment variables to add

### server/.env
```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
CRON_SECRET=some-long-random-string
```

### app/.env
```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EXPO_PUBLIC_API_URL=http://localhost:3000
```

---

## Dependencies to install

### app
```
expo install expo-health
npm install @stripe/stripe-react-native
```

### server
```
npm install stripe node-cron
npm install --save-dev @types/node-cron
```

---

## Definition of done for Phase 2

- [ ] User can save a card via Stripe SetupIntent
- [ ] `POST /challenges/start` creates a hold on the card (visible in Stripe dashboard as uncaptured)
- [ ] Step count reads correctly from Apple Health (iOS) and Google Fit (Android)
- [ ] `POST /steps/sync` updates the challenge's `stepsAchieved` in DB
- [ ] Home screen shows live step count, progress, countdown, and money at risk
- [ ] Cron job at 23:59 correctly releases hold (goal met) or captures charge (goal missed)
- [ ] All new routes are protected by `requireAuth` middleware

---

## Notes

- Use Stripe test mode keys throughout — never real keys in dev
- For the cron in dev, add a `POST /admin/trigger-reset` route (guarded by `CRON_SECRET`) so you can manually trigger the midnight logic without waiting
- Keep health API errors non-fatal — if step sync fails, show last known count with a "last synced X mins ago" label
