# Steppa — Claude Code Prompt Pack (Pivoted Spec)

Prize pool fitness challenges. Walk every day or lose your money to those who did.

---

## Mechanic (from real Steppa screenshots)

- User pays a **commitment fee** to join a public challenge (e.g. $20)
- Everyone's fees form a **prize pool** (46 people × $20 = $920)
- Walk your daily step goal **every single day** of the challenge
- **Miss one day → eliminated**, your $20 stays in the pool
- **Complete all days → qualified**, split the prize pool equally with other winners

---

## Infrastructure already set up

| Service | Used for |
|---|---|
| **Clerk** | Auth (sign up / sign in) |
| **Stripe** | Payment holds + captures |
| **Neon** | PostgreSQL database |

Do not recreate these — use your existing keys from each dashboard.

---

## Phases

| File | Phase | What gets built |
|---|---|---|
| `phase-1-foundation.md` | Foundation | Expo scaffold, Clerk auth, Express + Prisma on Neon, nav shell |
| `phase-2-core-mechanic.md` | Core Mechanic | Challenge create/join, Stripe hold/capture, step sync, midnight cron, home + discover screens |
| `phase-3-social-layer.md` | Social Layer | Participant leaderboard, push notifications (8am/9pm/11pm/result), onboarding flow |
| `phase-4-polish.md` | Polish | Activity history, profile stats, edge cases, legal screens, App Store prep |

---

## How to use

1. Open your project folder in terminal
2. Run `claude` to start Claude Code
3. Paste the contents of the current phase file
4. Complete every item in the **Definition of Done** checklist
5. Move to the next phase

---

## Tech Stack

```
Frontend:    React Native + Expo SDK 52 + Expo Router + TypeScript
Backend:     Node.js + Express + TypeScript
Database:    Neon PostgreSQL + Prisma ORM
Auth:        Clerk
Payments:    Stripe (PaymentIntents, manual capture)
Steps:       Apple HealthKit (iOS) + Google Fit (Android)
Push:        Expo Push Notifications
```

---

## Key design decisions

- **Manual capture Stripe model** — card is authorised (held) on join, only charged if eliminated. Winners' holds are cancelled.
- **Prize payouts are manual in v1** — cron logs payout amounts, you process via Stripe dashboard. Automate in v2.
- **Neon requires two connection strings** — `DATABASE_URL` (pooled, runtime) and `DIRECT_URL` (direct, migrations). Both in Neon dashboard.
- **Admin routes for testing** — `POST /admin/trigger-resolution` and `POST /admin/trigger-notifications` let you test without waiting for midnight.

---

## MVP success metric

Do users walk more on days they have money at stake, compared to days they don't?
