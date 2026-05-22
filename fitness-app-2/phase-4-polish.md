# Steppa — Phase 4: Polish & Launch Prep

Phases 1–3 are complete. Challenge browsing, joining with Stripe holds, step sync,
daily elimination cron, leaderboard, push notifications, and onboarding all work.

## Your job for Phase 4: Activity screen, profile stats, edge cases, App Store prep

---

## 1. Activity Screen — `app/(tabs)/activity.tsx`

The user's full challenge history.

### Backend — `GET /users/me/activity`
Returns all `ChallengeParticipant` records for the user, newest first.
Each includes:
- Challenge: title, commitmentFee, dailyStepGoal, durationDays, startDate, endDate
- Participant status: QUALIFIED / ELIMINATED / ACTIVE
- Daily progress: array of `{ date, stepsAchieved, goalSteps, completed }`
- Outcome: prize received (if QUALIFIED), amount lost (if ELIMINATED)

### UI

**Stats summary row** (top):
```
Won: 3    Lost: 2    Streak: 6 🔥    Earned: $47.50
```

**Past challenges list** (cards, newest first):

QUALIFIED card:
```
┌─────────────────────────────────────┐
│ 🏆 Cash Club          May 15–19     │
│ 5/5 days completed                  │
│ ■ ■ ■ ■ ■  (5 green dots)          │
│ +$18.40 won                         │
└─────────────────────────────────────┘
```

ELIMINATED card:
```
┌─────────────────────────────────────┐
│ 💀 Morning Movers     May 8–12      │
│ Out on day 3                        │
│ ■ ■ ✗ · ·  (2 green, 1 red, 2 grey)│
│ -$20.00 lost                        │
└─────────────────────────────────────┘
```

ACTIVE card (if any):
```
┌─────────────────────────────────────┐
│ 🏃 Cash Club          Today         │
│ Day 3 of 5 — In progress            │
│ ■ ■ ░ · ·                          │
│ $20 at risk                         │
└─────────────────────────────────────┘
```

Tap any card → navigate to `app/challenge/[id].tsx` for detail.

---

## 2. Profile Screen — `app/(tabs)/profile.tsx`

### Sections:

**Identity**
- Initials avatar (colored circle, no image upload for MVP)
- Name, email (from Clerk)
- Member since

**Challenge Stats**
```
Challenges entered:  12
Challenges won:       8    (Win rate: 67%)
Current streak:       6 🔥
Longest streak:      11 🔥
Total earned:      $94.50
Total lost:        $60.00
Net:              +$34.50
```

**Settings**
- Timezone (auto-detected, editable dropdown)
- Notification preferences:
  - Morning kickoff (toggle)
  - Danger zone warning (toggle)
  - Last hour panic (toggle)
  - Social join alerts (toggle)
- Save: `PATCH /users/me`

**Payment**
- Shows: `Visa •••• 4242  Exp 12/27`
- "Update card" → new SetupIntent flow (reuse onboarding payment screen)

**Legal**
- Privacy Policy (navigate to `app/(legal)/privacy.tsx`)
- Terms of Service (navigate to `app/(legal)/terms.tsx`)

**Account**
- Sign out → Clerk `signOut()`, redirect to sign-in
- Delete account → confirmation modal, type "DELETE" to confirm,
  call `DELETE /users/me`, sign out

### Backend — `DELETE /users/me`
- Authenticated
- Validates no ACTIVE challenge participations (if active, block deletion and inform user)
- Deletes user record (cascade via Prisma)
- Cancels Stripe customer
- Returns `{ success: true }`

---

## 3. Streak Logic

### Backend — `server/src/lib/streaks.ts`

```typescript
export async function recalculateStreak(userId: string): Promise<{
  currentStreak: number
  longestStreak: number
}>
```

A "streak day" = the user had at least one ACTIVE challenge that day AND completed it.
Count consecutive such days going backwards from yesterday.

Called from the midnight cron after resolving each user's day.
Updates `user.currentStreak` and `user.longestStreak`.

---

## 4. Edge Cases

### Not enough participants to run a challenge
Add `minParticipants` field to Challenge schema (default: 2).
If `challenge.startDate` arrives and `participantCount < minParticipants`:
- Set `challenge.status = CANCELLED`
- Cancel all Stripe PaymentIntents (no charge)
- Create `Transaction` with `type: REFUND` for each participant
- Send push: `"Cash Club was cancelled — not enough participants. No charge."`

### Payment capture failure (card declined)
When Stripe capture fails on elimination:
- Set `participant.status = ELIMINATED`
- Set a `paymentFailed: true` flag on the participant record
  (add this field to `ChallengeParticipant` in Prisma)
- Send push: `"💳 Your card failed. You're out of the challenge. Update your card."`
- Log for manual follow-up: `[PAYMENT FAILED] userId=xxx amount=xxx intentId=xxx`

### User joins mid-challenge
For MVP: challenges are only joinable while `status = OPEN` (before `startDate`).
If a user tries to join an ACTIVE challenge, return `400: { error: "Challenge already started" }`.

### User has no saved card and tries to join
Return `402: { error: "No payment method saved", code: "NO_PAYMENT_METHOD" }`.
Frontend catches this and opens the card-add bottom sheet.

### Step sync unavailable (permission denied or API error)
- Show persistent banner on Home: "⚠️ Steps not syncing — tap to fix"
- Tap → re-run `requestHealthPermissions()`
- Manual entry fallback: `POST /steps/manual` with `{ date, stepsCount }`,
  sets `manualEntry: true` on the StepLog — shown differently in activity history

### Challenge with no qualifiers (everyone eliminated)
If the challenge ends and `qualifiedCount = 0`:
- Set `challenge.status = COMPLETED`
- Log: `[CRON] Challenge xxx ended with 0 qualifiers — prize pool $xxx unallocated`
- For MVP: flag for manual review (no automated resolution)
- Consider donating to charity — leave a config `ZERO_WINNER_POLICY=charity|rollover`

---

## 5. Legal Screens

### `app/(legal)/privacy.tsx`

Content to include:
- What we collect: email, step count (daily total only), payment method (stored by Stripe, not us)
- What we don't collect: GPS location, health conditions, raw sensor data
- How step data is used: solely to determine challenge completion
- Stripe handles all payment data — we never see or store card numbers
- Data deletion: delete account removes all data within 30 days
- Contact: [your support email]

### `app/(legal)/terms.tsx`

Content to include:
- The forfeit mechanic: missing a day means your commitment fee is forfeited
- No refunds on forfeited stakes (you agreed to the challenge)
- Steppa is not a gambling platform — prize pools are funded by participant commitments, not the house
- Prize payouts may take 3–5 business days to process
- Daily step data must come from Apple Health or Google Fit — manual entries are accepted but flagged
- Steppa reserves the right to cancel challenges with insufficient participants (full refund)
- Minimum age: 18+
- Governing law: [your jurisdiction]

---

## 6. App Store Prep

### `app.config.ts` (convert from `app.json`):
```typescript
export default {
  name: "Steppa",
  slug: "steppa",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: { image: "./assets/splash.png", resizeMode: "contain", backgroundColor: "#0a0a0a" },
  ios: {
    bundleIdentifier: "com.yourname.steppa",
    supportsTablet: false,
    infoPlist: {
      NSHealthShareUsageDescription:
        "Steppa reads your daily step count to verify challenge completion.",
      NSHealthUpdateUsageDescription:
        "Steppa does not write to Apple Health.",
    },
  },
  android: {
    package: "com.yourname.steppa",
    permissions: ["android.permission.ACTIVITY_RECOGNITION"],
  },
  plugins: ["expo-router", "@stripe/stripe-react-native"],
}
```

### `eas.json` for EAS Build:
```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

---

## 7. Performance & Reliability

### Backend
- Add `morgan` for request logging
- Add global error handler middleware returning `{ error: string, message: string }`
- Rate limits:
  - `POST /challenges/:id/join` → 5 requests/min per user (prevent double-join spam)
  - `POST /steps/sync` → 10 requests/min per user
- `GET /health` should also verify DB: `prisma.$queryRaw('SELECT 1')`

### Frontend
- Add TanStack Query (`@tanstack/react-query`) for all API calls
- Global error boundary in `app/_layout.tsx`
- Offline detection via `@react-native-community/netinfo`:
  - Show banner: "You're offline — steps will sync when reconnected"
  - Queue sync and retry on reconnect

---

## Definition of done for Phase 4

- [ ] Activity screen shows all past challenges with correct outcome cards
- [ ] Stats summary row shows accurate win/loss/streak/earned data
- [ ] Profile screen shows all stats, settings, payment, and legal links
- [ ] Streak recalculates correctly after each midnight cron
- [ ] Cancelled challenge flow refunds all participants (Stripe cancel + push notification)
- [ ] Payment failure on capture is handled gracefully (no crash, logged, user notified)
- [ ] No-qualifier edge case is logged and flagged correctly
- [ ] Privacy policy and Terms of Service screens exist
- [ ] `app.config.ts` configured for both iOS and Android store submission
- [ ] `eas.json` present with dev / preview / production profiles
- [ ] All API errors return consistent JSON shape
- [ ] Offline state detected and shown to user

---

## Notes

- Prize payouts remain manual via Stripe dashboard in v1 — log all payout amounts
  clearly: `[PAYOUT] userId=xxx name=xxx amount=xxx challengeId=xxx`
- Do not implement public profiles or global leaderboards in v1 — keep scope tight
- Before TestFlight / Play Store internal testing:
  1. Switch Stripe to live mode keys
  2. Test the full join → eliminate → capture flow with a real $1 challenge
  3. Verify Apple Health permissions dialog appears correctly on a real device
