# Steppa — Phase 3: Social Layer + Onboarding

Phases 1 and 2 are complete. Users can browse challenges, join with a card hold,
sync steps, and get eliminated or qualified by the midnight cron.

## Your job for Phase 3: Participant feed, leaderboard, push notifications, onboarding

---

## 1. Participant Leaderboard in Challenge Detail

### Backend — `GET /challenges/:id/participants`
- Public route
- Returns all participants sorted by:
  1. Status: ACTIVE first, then QUALIFIED, then ELIMINATED
  2. Within ACTIVE: by today's `stepsAchieved` descending
- Each record:
  ```json
  {
    "userId": "...",
    "name": "Albert",
    "avatarInitial": "A",
    "status": "ACTIVE",
    "todaySteps": 7240,
    "todayGoal": 10000,
    "todayCompleted": false,
    "daysCompleted": 3,
    "daysTotal": 5
  }
  ```

### Frontend — add leaderboard section to `app/challenge/[id].tsx`

Below "How It Works", add:

**Participant list** (scrollable, paginated — 20 at a time):
```
┌──────────────────────────────────────┐
│ 🏃 Albert              7,240 / 10k  │
│ ████████░░  Day 3/5   ON TRACK 🟡   │
├──────────────────────────────────────┤
│ 🏃 Joel                9,800 / 10k  │
│ █████████░  Day 3/5   ALMOST ✅      │
├──────────────────────────────────────┤
│ 💀 Sarah               3,100 / 10k  │
│ ███░░░░░░░  Day 2/5   ELIMINATED 🔴  │
└──────────────────────────────────────┘
```

Status labels:
- `stepsAchieved >= goalSteps` → `DONE ✅`
- `>= 70% of goal` → `ON TRACK 🟡`
- `< 70% of goal, < 3h left` → `AT RISK 🔴`
- `< 70% of goal, > 3h left` → `BEHIND 🟠`
- `ELIMINATED` → `OUT 💀`
- `QUALIFIED` → `WINNER 🏆`

Pull-to-refresh to update leaderboard.

---

## 2. My Progress in Active Challenge

When the authenticated user is a participant, pin their row to the top of the
leaderboard with a highlight:

```
┌──────────────────────────────────────┐
│ YOU                    6,240 / 10k  │
│ ██████░░░░  Day 3/5   $20 at risk 💸 │
└──────────────────────────────────────┘
```

---

## 3. Push Notifications

### Backend — `server/src/lib/notifications.ts`

```typescript
export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: object
): Promise<void>
```

POST to `https://exp.host/--/api/v2/push/send`.

### Frontend — register token in `app/_layout.tsx`

After sign-in:
1. `Notifications.requestPermissionsAsync()`
2. `Notifications.getExpoPushTokenAsync()`
3. `POST /users/push-token` with the token

### Backend route — `POST /users/push-token`
- Authenticated
- Body: `{ token }`
- Updates `user.expoPushToken`

### Notification triggers (add to `server/src/jobs/dailyResolution.ts`):

**1. Daily morning kickoff — `08:00` local user time**
For each user in an ACTIVE challenge:
```
Title: "Day X of Y starts now 🏃"
Body:  "You need 10,000 steps today. $20 is on the line."
```

**2. Danger zone warning — `21:00` local user time**
For each user in an ACTIVE challenge where today's `DailyProgress.completed = false`:
```
Title: "⚠️ You still need X steps"
Body:  "3 hours left. $20 is on the line. Don't lose it."
```

**3. Last hour panic — `23:00` local user time**
Same condition as above, still not completed:
```
Title: "🚨 1 hour left — X steps to go"
Body:  "Your $20 is about to be gone. Move."
```

**4. Daily resolution result — sent by midnight cron after processing**
- Survived: `"✅ Day X done! Prize pool is now $Y. Keep going."`
- Eliminated: `"💸 You're out. You lost $20. Try the next challenge."`
- Challenge won: `"🏆 You won! $Y is being sent to you. Legend."`

**5. Someone joins your challenge (social proof)**
When `POST /challenges/:id/join` is called:
- Notify all existing ACTIVE participants:
  ```
  Title: "Someone just joined Cash Club"
  Body:  "Prize pool is now $Y. 46 people are in."
  ```
- Throttle: max 1 of these per user per hour

### Admin test route — `POST /admin/trigger-notifications`
- Guarded by `CRON_SECRET` header
- Body: `{ type: "morning" | "danger" | "panic" | "join" }`
- Triggers the specified notification for all eligible users immediately

---

## 4. Onboarding Flow — `app/(auth)/onboarding.tsx`

Triggered after first sign-up (`hasCompletedOnboarding = false`).

### Steps:

**Screen 1 — Welcome**
```
[Steppa logo / kangaroo mascot]

Walk or pay.

The fitness app that uses
financial fear to keep you moving.

[ Get Started → ]
```

**Screen 2 — How it works**
Three numbered steps (match the screenshot style):
```
① Commit money to a challenge
   Your fee joins the shared prize pool.

② Walk your daily step goal
   Every single day of the challenge.

③ Winners split the pool
   Losers fund the winners.

[ Sounds painful. I'm in → ]
```

**Screen 3 — Connect health data**
```
[Icon]
Steppa needs to read your steps

[ Connect Apple Health ] (iOS)
  or
[ Connect Google Fit ]   (Android)

Call requestHealthPermissions()
Show success state before continuing.

< Skip for now > (shows warning: manual sync only)
```

**Screen 4 — Add payment method**
```
[Card icon]
Add a card to join challenges

Your card is only charged if you
miss a day. We use Stripe to keep
your payment info secure.

[ Stripe CardField component ]

[ Save Card ]

< I'll do this later >
```

On save: call `POST /payments/setup-intent`, collect card with Stripe SDK,
call `POST /payments/save-method`.

**Screen 5 — Enable notifications**
```
[Bell icon]
Don't miss the danger zone warning

We'll remind you when you're
running out of time and money.

[ Turn on Notifications ]

< Skip >
```

**Screen 6 — Done**
```
[Confetti / mascot]

You're ready.

[ Browse Challenges → ]
```

On complete:
- `PATCH /users/me` → `{ hasCompletedOnboarding: true }`
- Navigate to `(tabs)/discover`

---

## 5. User Routes — `server/src/routes/users.ts`

### `POST /users/sync`
- Called after Clerk sign-up webhook or first app open
- Creates User record in DB if not exists (using `clerkId`)
- Returns user object

### `PATCH /users/me`
- Authenticated
- Body: partial User fields (`hasCompletedOnboarding`, `timezone`, `name`, etc.)
- Updates and returns updated user

### `GET /users/me`
- Authenticated
- Returns full user object including stats

### `POST /users/push-token`
- Authenticated
- Body: `{ token }`
- Updates `expoPushToken`

---

## Definition of done for Phase 3

- [ ] Challenge detail screen shows live participant leaderboard
- [ ] Authenticated user's row is pinned to top with highlight
- [ ] Status badges render correctly for all 6 states
- [ ] Push token registered on sign-in and stored in DB
- [ ] Morning kickoff notification fires at 8 AM (test via admin trigger)
- [ ] Danger zone notification fires at 9 PM (test via admin trigger)
- [ ] Last hour panic notification fires at 11 PM (test via admin trigger)
- [ ] Resolution notification fires after midnight cron
- [ ] "Someone joined" notification fires on join (throttled)
- [ ] Full onboarding flow completes and navigates to Discover tab
- [ ] `PATCH /users/me` saves onboarding completion flag

---

## Notes

- Kangaroo mascot: use a placeholder emoji 🦘 in onboarding for now — the actual
  mascot asset from the screenshots will be added in Phase 4 (design)
- Timezone handling for notifications: store user timezone during onboarding
  (auto-detect with `Intl.DateTimeFormat().resolvedOptions().timeZone` on the device)
  and save to `user.timezone` via `PATCH /users/me`
- The "someone joined" notification should not fire for the person who just joined —
  only for existing participants
