# Steppa — Phase 3: Social Layer

Phases 1 and 2 are complete. The core mechanic works: users can stake money,
sync steps, and get charged or released at midnight.

## Your job for Phase 3: Social Layer

Build squads, the group leaderboard, and push notifications. This is the viral
engine of the app — the pressure of your friends seeing you at 800/10,000 steps
with 40 minutes left is the whole product.

---

## 1. Squad Backend Routes

### `POST /squads/create`
- Authenticated
- Body: `{ name }`
- Creates a `Squad` record, auto-generates `inviteCode` (6-char uppercase, e.g. `STEPX9`)
- Adds the creator as the first `SquadMember`
- Returns `{ squadId, inviteCode }`

### `POST /squads/join`
- Authenticated
- Body: `{ inviteCode }`
- Looks up squad by `inviteCode`
- Adds user as `SquadMember` if not already a member
- Cap: max 10 members per squad — return `400` if full
- Returns `{ squadId, squadName, memberCount }`

### `GET /squads/mine`
- Returns the authenticated user's squad (assume one squad per user for MVP)
- Includes: squad name, invite code, member list with today's step data

### `GET /squads/:id/leaderboard`
- Returns all members of the squad with:
  - `userId`, `name`
  - `stepsToday` (from latest StepLog)
  - `goalSteps`, `stakeAmount` (from today's Challenge, if active)
  - `percentComplete` (stepsToday / goalSteps)
  - `status`: `ON_TRACK | AT_RISK | SAFE | NO_CHALLENGE`
  - `timeUntilMidnight` in user's timezone

Status logic:
- `SAFE` — challenge completed today
- `ON_TRACK` — on pace to hit goal by midnight (current steps / elapsed day % >= 80%)
- `AT_RISK` — active challenge but behind pace
- `NO_CHALLENGE` — no active challenge today

---

## 2. Squad Screen — `app/(tabs)/squad.tsx`

Build the real Squad screen (logic + structure, styling in Phase 4):

### If user has no squad:
- Show two options:
  - **Create Squad** — input for squad name, submit calls `POST /squads/create`, shows invite code on success
  - **Join Squad** — input for 6-char invite code, submit calls `POST /squads/join`

### If user has a squad:
- Squad name + invite code (tap to copy)
- Leaderboard list, sorted by `percentComplete` descending
- Each row shows:
  - Member name + avatar initial
  - Step progress bar
  - `stepsToday / goalSteps` count
  - Status badge (`AT RISK 🔴`, `ON TRACK 🟡`, `SAFE 🟢`, `NO CHALLENGE ⚪`)
  - Money at risk (if active challenge)
- Refresh on pull-to-refresh

### The pressure card (key UI element):
At the top of the leaderboard, show a highlighted card for the most at-risk member:
```
⚠️ Joel still needs 2,400 steps
💸 $30 at risk — 47 mins left
```
Only show if someone in the squad is AT_RISK with < 2 hours left.

---

## 3. Push Notifications

### Backend — `server/src/lib/notifications.ts`

Use **Expo Push Notifications API** (no extra SDK needed server-side, just HTTP):

```typescript
export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: object
): Promise<void>
```

POST to `https://exp.host/--/api/v2/push/send`

### Store push tokens

Add `expoPushToken` field to the `User` model in Prisma:
```prisma
expoPushToken  String?
```

Add route `POST /users/push-token`:
- Body: `{ token }`
- Updates the authenticated user's `expoPushToken`

### Notification triggers (add to the midnight cron job)

1. **11:00 PM warning** — new cron at `23:00` user local time
   - Query users with ACTIVE challenges where `stepsAchieved < goalSteps * 0.9`
   - Send: `"⚠️ You still need X steps — 1 hour left. $Y is on the line."`

2. **Squad pressure notification** — when a squad member syncs steps and is AT_RISK with < 1 hour left
   - Notify other squad members: `"Joel needs 1,200 more steps — 52 mins left 👀"`
   - Throttle: max 1 squad pressure notification per user per hour

3. **Challenge result** — sent by the midnight cron after resolution
   - Success: `"✅ You did it! $Y is safe. Streak: X days 🔥"`
   - Forfeit: `"💸 You lost $Y today. Don't let it happen again tomorrow."`

### Frontend — register for push notifications

In `app/_layout.tsx`, after sign-in:
1. Call `Notifications.requestPermissionsAsync()`
2. Call `Notifications.getExpoPushTokenAsync()`
3. POST token to `POST /users/push-token`

---

## 4. Onboarding Flow — `app/(auth)/onboarding.tsx`

After first sign-up (detect with a `hasCompletedOnboarding` flag on User), route to onboarding before the tabs.

Steps:
1. **Welcome screen** — "Steppa. Walk or pay." CTA: Get Started
2. **Step goal** — slider: 5,000 / 7,500 / 10,000 / 12,500 / 15,000. Default 10,000
3. **Stake amount** — picker: $5 / $10 / $20 / $30. Show loss aversion copy: "You'll lose this if you miss your goal."
4. **Connect health** — call `requestHealthPermissions()`. Show platform-appropriate instructions.
5. **Add payment** — embed Stripe's `<CardField />` to save card on file. Call `POST /payments/setup-intent`.
6. **Enable notifications** — request push permission. Skip option available.
7. **You're set** — summary card showing their settings. CTA: "Start today's challenge"

On completing onboarding:
- Set `hasCompletedOnboarding: true` on User via `PATCH /users/me`
- Call `POST /challenges/start` with their chosen goal + stake
- Route to `(tabs)/index`

---

## New Prisma fields

```prisma
// Add to User model:
expoPushToken          String?
hasCompletedOnboarding Boolean @default(false)
defaultGoalSteps       Int     @default(10000)
defaultStakeAmount     Decimal @default(10.00) @db.Decimal(10, 2)
```

Run `npx prisma migrate dev --name add-onboarding-push-fields`

---

## Definition of done for Phase 3

- [ ] User can create a squad and share an invite code
- [ ] User can join a squad via invite code
- [ ] Squad leaderboard shows all members with live step data + status badges
- [ ] Pressure card appears when a member is AT_RISK with < 2 hours left
- [ ] Push token is registered on sign-in and stored in DB
- [ ] 11 PM warning notification fires correctly (test via `/admin/trigger-notifications`)
- [ ] Challenge result notification fires after midnight cron
- [ ] Onboarding flow completes and starts the first challenge

---

## Notes

- Add `POST /admin/trigger-notifications` (guarded by `CRON_SECRET`) for testing push notifications without waiting until 11 PM
- Squad leaderboard should be fast — consider a single SQL join query rather than multiple round trips
- For the squad pressure notification, make sure you're not spamming users — the 1/hour throttle is important
