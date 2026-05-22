# Steppa — Phase 4: Polish & Launch Prep

Phases 1–3 are complete. Auth, core mechanic, payments, step sync, squads,
leaderboard, and push notifications all work.

## Your job for Phase 4: Polish, stats, edge cases, and launch readiness.

---

## 1. History Screen — `app/(tabs)/history.tsx`

Build the full History screen.

### Data: `GET /challenges/history`
Returns last 90 days. Each record includes:
`date`, `goalSteps`, `stepsAchieved`, `stakeAmount`, `status`

### UI elements:

**Stats summary row** (top of screen):
```
Completed: 18    Forfeited: 4    Streak: 6 🔥    Total saved: $180
```

**Calendar heatmap** (last 30 days):
- Each day is a small square
- 🟢 Green = COMPLETED
- 🔴 Red = FORFEITED
- ⚫ Grey = no challenge
- Tap a day to see details (steps, goal, stake outcome)

**Challenge list** (scrollable, below calendar):
- Each row: date, `stepsAchieved / goalSteps`, status badge, amount won/lost
- Sort: newest first

---

## 2. Profile Screen — `app/(tabs)/profile.tsx`

### Sections:

**Identity**
- Avatar (initials-based, no image upload for MVP)
- Name, email (from Clerk)
- Member since date

**Stats**
- Total challenges: X
- Win rate: X%
- Current streak: X days 🔥
- Longest streak: X days
- Total money saved: $X
- Total money lost: $X
- Net: +$X / -$X

**Settings**
- Default daily goal (editable, updates `defaultGoalSteps` on User)
- Default stake amount (editable, updates `defaultStakeAmount` on User)
- Timezone (auto-detected, but show and allow override)
- Notification preferences (toggle: warnings on/off, squad alerts on/off)

**Payment**
- Show last 4 digits of saved card
- "Update card" → new SetupIntent flow

**Account**
- Sign out (Clerk `signOut()`)
- Delete account (shows confirmation modal, calls `DELETE /users/me`)

---

## 3. Streak Logic — Backend

Add to `server/src/lib/streaks.ts`:

```typescript
export async function recalculateStreak(userId: string): Promise<number>
```

- Counts consecutive COMPLETED challenge days going backwards from yesterday
- Called after every challenge resolution in the midnight cron
- Updates a `currentStreak` and `longestStreak` field on User

Add to Prisma User model:
```prisma
currentStreak  Int @default(0)
longestStreak  Int @default(0)
totalSaved     Decimal @default(0) @db.Decimal(10, 2)
totalLost      Decimal @default(0) @db.Decimal(10, 2)
```

Run `npx prisma migrate dev --name add-streak-stats`

---

## 4. Edge Cases to Handle

### Payment failures
- If Stripe PaymentIntent capture fails (insufficient funds etc.):
  - Set challenge `status: FORFEIT_FAILED`
  - Send push: "💳 Payment failed. Please update your card."
  - Add `POST /challenges/:id/retry-forfeit` route

### Health permission denied
- If user denies health permissions during onboarding:
  - Allow them to proceed but show a persistent banner: "Step sync disabled — tap to enable"
  - Manual step entry fallback: let user input steps manually (flag as `manualEntry: true` on StepLog, visible in history)

### No challenge started today
- Home screen shows a "Start today's challenge" CTA instead of the progress ring
- Uses `defaultGoalSteps` and `defaultStakeAmount` from User as prefilled values

### Squad member leaves
- `DELETE /squads/:id/leave` — removes SquadMember record
- If they were the only member, delete the squad
- If they created the squad, transfer ownership to the next oldest member

### Timezone edge cases
- User travels across timezone: use the timezone set on their profile, not device timezone, for challenge resolution
- Warn user if device timezone differs from profile timezone: "Your profile timezone is SGT. Update it?"

---

## 5. App Store Prep

### `app.json` / `app.config.ts` updates
```json
{
  "name": "Steppa",
  "slug": "steppa",
  "version": "1.0.0",
  "ios": {
    "bundleIdentifier": "com.yourname.steppa",
    "infoPlist": {
      "NSHealthShareUsageDescription": "Steppa reads your step count to track your daily challenge progress.",
      "NSHealthUpdateUsageDescription": "Steppa does not write health data."
    }
  },
  "android": {
    "package": "com.yourname.steppa",
    "permissions": ["android.permission.ACTIVITY_RECOGNITION"]
  }
}
```

### Privacy policy page
Create a simple `app/(legal)/privacy.tsx` screen with:
- What data is collected (steps, payment method via Stripe, email)
- How it's used
- Stripe handles all payment data (PCI compliant)
- No health data is stored on Steppa servers beyond daily step counts
- Contact email for data deletion requests

### Terms of service page
Create `app/(legal)/terms.tsx` with:
- Description of the forfeit mechanic
- Daily cap of $30
- No gambling classification (forfeited funds go to charity)
- Refund policy (no refunds for forfeited stakes — user agreed to the challenge)
- Right to terminate account

---

## 6. Performance & Reliability

### Backend
- Add request logging with `morgan`
- Add error handling middleware that returns consistent `{ error, message }` JSON
- Add `GET /health` to return DB connectivity status (Prisma `$queryRaw('SELECT 1')`)
- Rate limit sensitive routes: `POST /challenges/start` → max 1/day per user

### Frontend
- Add `react-query` (TanStack Query) for all API calls — handles caching, loading states, refetching
- Add a global error boundary in `_layout.tsx`
- Add offline banner: detect network state with `@react-native-community/netinfo`, show "You're offline — steps will sync when reconnected"

---

## Definition of done for Phase 4

- [ ] History screen shows calendar heatmap + stats summary + challenge list
- [ ] Profile screen shows all stats, settings, and payment management
- [ ] Streak is calculated correctly and updates after each midnight cron run
- [ ] All 5 edge cases are handled gracefully (no crashes, clear user messaging)
- [ ] `app.json` is configured for both iOS and Android store submission
- [ ] Privacy policy and Terms of Service screens exist and are linked from onboarding
- [ ] All API errors return consistent JSON shape
- [ ] Offline state is detected and shown to the user

---

## Notes

- Do not add social features beyond squads in this phase (no public profiles, no global leaderboards) — keep scope tight for v1
- The calendar heatmap can be built with a simple grid of `View` components — no library needed
- Test the full flow end-to-end in Stripe test mode before any real money is involved
- Keep `DELETE /users/me` behind a confirmation: require the user to type "DELETE" to confirm
