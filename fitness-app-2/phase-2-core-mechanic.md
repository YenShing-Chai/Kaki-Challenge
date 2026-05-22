# Steppa — Phase 2: Core Mechanic

Phase 1 is complete. Clerk auth works, Neon DB is connected via Prisma, Express
is running. Navigation shell is in place.

## Your job for Phase 2: Prize pool challenges + step sync + daily resolution

The core loop:
1. A challenge is created (public, fixed commitment fee, step goal, duration)
2. Users join by paying the commitment fee (Stripe hold)
3. Every midnight, each participant's steps are checked
4. Miss a day → ELIMINATED, payment captured (money stays in prize pool)
5. Complete all days → QUALIFIED, share the prize pool equally

---

## 1. Challenge Routes — `server/src/routes/challenges.ts`

### `POST /challenges/create`
- Authenticated (operator/admin only for MVP — check `req.auth.userId` against an
  `ADMIN_CLERK_ID` env var)
- Body:
  ```json
  {
    "title": "Cash Club",
    "description": "Walk 10k steps per day for 5 days",
    "commitmentFee": 20,
    "dailyStepGoal": 10000,
    "durationDays": 5,
    "startDate": "2026-05-15",
    "maxParticipants": null
  }
  ```
- Computes `endDate = startDate + durationDays - 1`
- Creates `Challenge` with `status: OPEN`, `prizePool: 0`
- Returns `{ challengeId }`

### `GET /challenges`
- Public route (no auth required)
- Returns all challenges where `status = OPEN` or `status = ACTIVE`
- Include participant count and current prize pool
- Sort: soonest `startDate` first

### `GET /challenges/:id`
- Public route
- Returns full challenge detail:
  - All fields
  - `participantCount`
  - `prizePool`
  - `qualifiedCount` (participants still ACTIVE or QUALIFIED)
  - `userParticipation` (null if not authed or not joined, otherwise their status + daily progress)

### `POST /challenges/:id/join`
- Authenticated
- Validates:
  - Challenge status is `OPEN`
  - User has a saved payment method (`stripePaymentMethodId` on User)
  - User is not already a participant
  - Under `maxParticipants` if set
- Creates Stripe PaymentIntent:
  ```
  amount: commitmentFee (in cents)
  currency: "usd"
  customer: user.stripeCustomerId
  payment_method: user.stripePaymentMethodId
  capture_method: "manual"   ← authorise only, do NOT charge yet
  confirm: true
  ```
- Creates `ChallengeParticipant` with `status: ACTIVE`
- Creates `DailyProgress` records for each day of the challenge (one per day, all `completed: false`)
- Increments `challenge.prizePool` by `commitmentFee`
- Creates `Transaction` with `type: COMMITMENT_HOLD`
- Returns `{ participantId, prizePool }`

---

## 2. Step Sync

### Frontend — `app/lib/health.ts`

```typescript
export async function requestHealthPermissions(): Promise<boolean>
export async function getTodaySteps(): Promise<number>
```

- **iOS:** `expo-health`, read `HKQuantityTypeIdentifierStepCount` for today
- **Android:** Google Fit REST API via `@react-native-google-signin/google-signin`
  - Scope: `https://www.googleapis.com/auth/fitness.activity.read`
  - Aggregate `derived:com.google.step_count.delta` for today

### Backend — `POST /steps/sync`
- Authenticated
- Body: `{ date, stepsCount }`
- Upserts `StepLog` for user + date
- For each ACTIVE `ChallengeParticipant` the user has in a challenge that includes this date:
  - Upsert `DailyProgress` for that participant + date
  - Set `stepsAchieved = stepsCount`
  - Set `completed = stepsCount >= goalSteps`
- Returns `{ stepsCount, activeParticipations: [{ challengeId, stepsNeeded, completed }] }`

### Frontend — sync schedule in `app/(tabs)/index.tsx`
- Sync on app foreground (`AppState` listener)
- Sync every 15 minutes while open (`setInterval`)
- POST to `/steps/sync` after each read

---

## 3. Daily Midnight Resolution Cron

### `server/src/jobs/dailyResolution.ts`

Use `node-cron`. Run at `00:01` daily (just after midnight UTC — use user timezones
for accuracy in Phase 3, for now resolve at midnight UTC).

Logic for each day's resolution:
```
For each Challenge where status = ACTIVE and (today - 1) is a challenge day:
  For each ChallengeParticipant where status = ACTIVE:
    Find DailyProgress for yesterday
    If completed = false (missed the day):
      → Set participant.status = ELIMINATED
      → Capture their Stripe PaymentIntent (charge the card)
      → Create Transaction: type = COMMITMENT_CAPTURE
      → Log: [CRON] ELIMINATED userId=xxx challengeId=xxx
    Else:
      → Log: [CRON] SURVIVED userId=xxx challengeId=xxx

  If challenge endDate has passed:
    → Find all participants where status = ACTIVE (survivors)
    → Set each to status = QUALIFIED
    → Calculate payout = prizePool / qualifiedCount
    → For each QUALIFIED participant:
        Create Transaction: type = PRIZE_PAYOUT, amount = payout
        Update user.totalWon += payout
        (Stripe payouts to be handled manually in MVP — log payout amounts)
    → Set challenge.status = COMPLETED
    → For each ELIMINATED participant:
        Update user.totalLost += commitmentFee
```

Add `POST /admin/trigger-resolution` (guarded by `CRON_SECRET` header) for
manual testing without waiting for midnight.

---

## 4. Payment Setup Routes — `server/src/routes/payments.ts`

### `POST /payments/setup-intent`
- Authenticated
- Creates or retrieves Stripe Customer for the user (save `stripeCustomerId` to DB)
- Creates a Stripe SetupIntent
- Returns `{ clientSecret, customerId }`

### `POST /payments/save-method`
- Authenticated
- Body: `{ paymentMethodId }`
- Attaches PaymentMethod to Stripe Customer
- Saves `stripePaymentMethodId` to User in DB
- Returns `{ success: true }`

### `GET /payments/method`
- Authenticated
- Returns the saved payment method details (last4, brand, expMonth, expYear)
- Returns `{ method: null }` if none saved

---

## 5. Home Screen — `app/(tabs)/index.tsx`

Show the user's active challenge participations.

For each active participation, show a card:
```
┌─────────────────────────────────┐
│ Cash Club                       │
│ Day 3 of 5                      │
│                                 │
│  [Step progress ring]           │
│  6,240 / 10,000 steps           │
│                                 │
│  Prize Pool: $920  |  46 in     │
│  Your stake: $20                │
│                                 │
│  ⏱ 4h 22m left today           │
└─────────────────────────────────┘
```

If no active participations:
- Show "No active challenges" with CTA → navigate to Discover tab

State per card:
```typescript
{
  challenge: Challenge
  participation: ChallengeParticipant
  todayProgress: DailyProgress
  currentSteps: number
  isSyncing: boolean
}
```

---

## 6. Discover Screen — `app/(tabs)/discover.tsx`

Show open challenges available to join.

Each challenge card (matching the screenshot layout):
```
┌─────────────────────────────────┐
│ 🟡 OPEN TO JOIN  🌐 Public      │
│                                 │
│ Cash Club                  [S]  │
│ Walk 10k steps per day for 5d   │
│ May 15-19, 2026                 │
│                                 │
│ PRIZE POOL                      │
│ $920                            │
│ Finish all challenge days       │
│ to share the prize pool         │
│                                 │
│ $20        46        10k   5d   │
│ Commit  Participants  Steps  Days│
└─────────────────────────────────┘
         [ Join Challenge → ]
```

On tap → navigate to `app/challenge/[id].tsx` (challenge detail screen)

---

## 7. Challenge Detail Screen — `app/challenge/[id].tsx`

Matches the screenshots exactly. Sections:
1. Header: title, status badge, creator
2. Prize pool hero: large `$920` number, subtext
3. Stats row: commitment / participants / daily steps / duration
4. Participant avatars (first 4 + overflow count) + "X people are in / You can still join"
5. **How It Works** section (numbered steps):
   - `1` Commitment: $X — Your participation fee joins the shared pool
   - `2` Complete Xk+ steps every day for Y days — Stay in the challenge to qualify
   - `3` Complete all challenge days to qualify — The prize pool gets split among the winners
6. CTA: swipe-to-confirm button — "Using $X from your balance" (or "Add card first")

Join flow on CTA:
- If no saved card → show bottom sheet to add card (`POST /payments/setup-intent`)
- If card saved → confirm join, call `POST /challenges/:id/join`
- Show success state with confetti

---

## Dependencies to install

### app
```
expo install expo-health
npx expo install @stripe/stripe-react-native
npm install @react-native-google-signin/google-signin
```

### server
```
npm install stripe node-cron
npm install --save-dev @types/node-cron
```

---

## Environment variables to add

### server/.env
```
STRIPE_WEBHOOK_SECRET=
CRON_SECRET=generate-a-long-random-string
ADMIN_CLERK_ID=                           # your own Clerk user ID for admin routes
```

### app/.env
```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

---

## Definition of done for Phase 2

- [ ] `POST /challenges/create` creates a challenge (admin only)
- [ ] `GET /challenges` returns open challenges
- [ ] Challenge detail screen matches screenshot layout
- [ ] User can save a card via Stripe SetupIntent
- [ ] `POST /challenges/:id/join` creates a Stripe hold (visible in Stripe dashboard as uncaptured)
- [ ] Step count reads from Apple Health (iOS) / Google Fit (Android)
- [ ] `POST /steps/sync` updates DailyProgress records
- [ ] Home screen shows active challenge card with live steps + countdown
- [ ] Midnight cron eliminates missed participants and captures their payment
- [ ] `POST /admin/trigger-resolution` works for manual testing
- [ ] All TypeScript compiles clean

---

## Notes

- Use Stripe test mode — never real keys in dev
- Prize payouts in MVP are logged only (no automated Stripe payout to bank) — add a note
  in the admin logs: "PAYOUT userId=xxx amount=xxx — process manually via Stripe dashboard"
- Keep health errors non-fatal — show "last synced X mins ago" if sync fails
- The swipe-to-confirm CTA on the detail screen: use a simple `PanGestureHandler`
  from `react-native-gesture-handler` (already in Expo)
