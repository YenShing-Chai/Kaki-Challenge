# Steppa — Claude Code Prompt Pack

Loss-aversion fitness app. Walk or pay.

## How to use these files

1. Open your project folder in terminal
2. Run `claude` to start Claude Code
3. Feed the prompt for the current phase
4. Work through the Definition of Done checklist before moving to the next phase

---

## Phases

| File | Phase | What gets built |
|---|---|---|
| `phase-1-foundation.md` | Foundation | Expo scaffold, Clerk auth, Express server, Prisma schema, nav shell |
| `phase-2-core-mechanic.md` | Core Mechanic | Stripe holds/forfeit, Apple Health + Google Fit sync, midnight cron, home screen |
| `phase-3-social-layer.md` | Social Layer | Squads, leaderboard, push notifications, onboarding flow |
| `phase-4-polish.md` | Polish | History screen, profile, streak logic, edge cases, App Store prep |

---

## Before you start

You'll need accounts for:
- [Clerk](https://clerk.com) — auth (free tier is fine)
- [Stripe](https://stripe.com) — payments (use test mode throughout dev)
- [Expo](https://expo.dev) — for push notifications + builds
- A local PostgreSQL instance (or [Railway](https://railway.app) for a free cloud one)

---

## Tech Stack Summary

```
Frontend:    React Native + Expo SDK 52 + Expo Router + TypeScript
Backend:     Node.js + Express + TypeScript
Database:    PostgreSQL + Prisma ORM
Auth:        Clerk
Payments:    Stripe (PaymentIntents with manual capture)
Steps:       Apple HealthKit (iOS) + Google Fit (Android)
Push:        Expo Push Notifications
```

---

## MVP Success Metric

Do users walk more on days they have money staked?
Everything else is secondary.
