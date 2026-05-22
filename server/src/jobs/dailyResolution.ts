import cron from 'node-cron';
import { and, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';

import { db } from '../lib/db';
import {
  users,
  challenges,
  challengeParticipants,
  dailyProgress,
  transactions,
} from '../db/schema';
import { stripe } from '../lib/stripe';
import { addDaysUtc, todayUtc } from '../lib/date';
import { sendPushNotification } from '../lib/notifications';
import { recalculateStreak } from '../lib/streaks';
import { weekIndex, weekQuotaSatisfied } from '../lib/gameFormat';

/**
 * Resolve every active challenge for *yesterday*. Two passes:
 *   1. Eliminate participants who missed yesterday → capture their hold.
 *   2. Settle challenges whose endDate has now passed.
 *
 * Idempotent: re-running on an already-resolved day is a no-op.
 */
export async function runDailyResolution(
  now: Date = new Date(),
  options: { onlyChallengeId?: string } = {},
): Promise<void> {
  const yesterday = addDaysUtc(todayUtc(now), -1);

  const active = await db.query.challenges.findMany({
    where: and(
      inArray(challenges.status, ['OPEN', 'ACTIVE']),
      lte(challenges.startDate, yesterday),
      gte(challenges.endDate, yesterday),
      ...(options.onlyChallengeId ? [eq(challenges.id, options.onlyChallengeId)] : []),
    ),
    with: {
      participants: {
        where: eq(challengeParticipants.status, 'ACTIVE'),
        with: {
          dailyProgress: { where: eq(dailyProgress.date, yesterday) },
        },
      },
    },
  });

  for (const challenge of active) {
    if (challenge.status === 'OPEN') {
      await db.update(challenges).set({ status: 'ACTIVE' }).where(eq(challenges.id, challenge.id));
    }

    if (challenge.gameFormat === 'WEEKLY_QUOTA') {
      await resolveWeeklyChallenge(challenge.id, yesterday);
      continue;
    }

    if (challenge.gameFormat === 'COMPLETION_COUNT') {
      continue;
    }

    for (const part of challenge.participants) {
      const progress = part.dailyProgress[0];
      const missed = !progress || !progress.completed;
      const [tokenRow] = await db
        .select({ expoPushToken: users.expoPushToken })
        .from(users)
        .where(eq(users.id, part.userId))
        .limit(1);
      const token = tokenRow?.expoPushToken ?? null;

      if (!missed) {
        const [poolRow] = await db
          .select({ prizePool: challenges.prizePool })
          .from(challenges)
          .where(eq(challenges.id, challenge.id))
          .limit(1);
        const dayIndex =
          Math.floor(
            (yesterday.getTime() - challenge.startDate.getTime()) / 86400000,
          ) + 1;
        console.log(`[CRON] SURVIVED userId=${part.userId} challengeId=${challenge.id}`);
        if (token) {
          await sendPushNotification(
            token,
            `✅ Day ${dayIndex} done!`,
            `Prize pool is now $${Number(poolRow?.prizePool ?? 0).toFixed(2)}. Keep going.`,
          );
        }
        continue;
      }

      let captured = true;
      try {
        if (part.stripePaymentIntentId && stripe) {
          await stripe.paymentIntents.capture(part.stripePaymentIntentId);
        }
      } catch (err) {
        captured = false;
        console.error(
          `[PAYMENT FAILED] userId=${part.userId} amount=$${Number(part.commitmentPaid).toFixed(2)} intentId=${part.stripePaymentIntentId} — ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }

      try {
        await db.transaction(async (tx) => {
          await tx
            .update(challengeParticipants)
            .set({ status: 'ELIMINATED', paymentFailed: !captured })
            .where(eq(challengeParticipants.id, part.id));
          if (captured) {
            await tx.insert(transactions).values({
              userId: part.userId,
              type: 'COMMITMENT_CAPTURE',
              amount: String(part.commitmentPaid),
              stripePaymentIntentId: part.stripePaymentIntentId,
              description: `Eliminated from ${challenge.title}`,
            });
            await tx
              .update(users)
              .set({
                totalLost: sql`${users.totalLost} + ${part.commitmentPaid}`,
                updatedAt: new Date(),
              })
              .where(eq(users.id, part.userId));
          }
        });
        console.log(`[CRON] ELIMINATED userId=${part.userId} challengeId=${challenge.id}`);
        if (token) {
          await sendPushNotification(
            token,
            captured ? "💸 You're out" : '💳 Your card failed',
            captured
              ? `You lost $${Number(part.commitmentPaid).toFixed(2)}. Try the next challenge.`
              : "You're out of the challenge. Update your card on the Profile tab.",
          );
        }
      } catch (err) {
        console.error(
          `[CRON] DB update failed for participant=${part.id}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }
  }

  // Recalculate streaks for every user touched in Pass 1.
  const touchedUserIds = new Set<string>();
  for (const c of active) for (const p of c.participants) touchedUserIds.add(p.userId);
  for (const userId of touchedUserIds) {
    try {
      await recalculateStreak(userId);
    } catch (err) {
      console.warn(
        `[CRON] streak recalc failed for user=${userId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  // Pass 2 — settle challenges that have ended.
  const today = todayUtc(now);
  const ended = await db.query.challenges.findMany({
    where: and(
      eq(challenges.status, 'ACTIVE'),
      lt(challenges.endDate, today),
      ...(options.onlyChallengeId ? [eq(challenges.id, options.onlyChallengeId)] : []),
    ),
    with: { participants: { with: { dailyProgress: true } } },
  });

  for (const challenge of ended) {
    let participants = challenge.participants;

    if (challenge.gameFormat === 'COMPLETION_COUNT') {
      const target = challenge.targetDaysComplete ?? challenge.durationDays;
      for (const part of participants) {
        if (part.status !== 'ACTIVE') continue;
        const completedDays = part.dailyProgress.filter((d) => d.completed).length;
        if (completedDays < target) {
          const [tokenRow] = await db
            .select({ expoPushToken: users.expoPushToken })
            .from(users)
            .where(eq(users.id, part.userId))
            .limit(1);
          await eliminateWeekly(part, challenge.title, tokenRow?.expoPushToken ?? null);
        }
      }
      const fresh = await db.query.challengeParticipants.findMany({
        where: eq(challengeParticipants.challengeId, challenge.id),
        with: { dailyProgress: true },
      });
      participants = fresh;
    }

    const survivors = participants.filter((p) => p.status === 'ACTIVE');
    const eliminated = participants.filter((p) => p.status === 'ELIMINATED');
    const pool = Number(challenge.prizePool);
    const payout = survivors.length > 0 ? pool / survivors.length : 0;

    await db.transaction(async (tx) => {
      for (const s of survivors) {
        if (s.stripePaymentIntentId && stripe) {
          try {
            await stripe.paymentIntents.cancel(s.stripePaymentIntentId);
          } catch (err) {
            console.warn(
              `[CRON] cancel hold failed for participant=${s.id}: ${err instanceof Error ? err.message : 'unknown'}`,
            );
          }
        }
        await tx
          .update(challengeParticipants)
          .set({ status: 'QUALIFIED' })
          .where(eq(challengeParticipants.id, s.id));
        if (payout > 0) {
          await tx.insert(transactions).values({
            userId: s.userId,
            type: 'PRIZE_PAYOUT',
            amount: String(payout),
            description: `Payout from ${challenge.title}`,
          });
          await tx
            .update(users)
            .set({ totalWon: sql`${users.totalWon} + ${payout}`, updatedAt: new Date() })
            .where(eq(users.id, s.userId));
        }
      }
      await tx
        .update(challenges)
        .set({ status: 'COMPLETED' })
        .where(eq(challenges.id, challenge.id));
    });

    for (const s of survivors) {
      if (payout > 0) {
        console.log(
          `[PAYOUT] userId=${s.userId} amount=$${payout.toFixed(2)} challengeId=${challenge.id} — process manually in Stripe dashboard`,
        );
      }
    }

    if (survivors.length === 0 && eliminated.length > 0) {
      console.log(
        `[CRON] Challenge ${challenge.id} ended with 0 qualifiers — prize pool $${pool.toFixed(2)} unallocated. ZERO_WINNER_POLICY=${process.env.ZERO_WINNER_POLICY ?? 'charity'}`,
      );
    }

    for (const s of survivors) {
      const [userRow] = await db
        .select({ expoPushToken: users.expoPushToken })
        .from(users)
        .where(eq(users.id, s.userId))
        .limit(1);
      if (!userRow?.expoPushToken) continue;
      await sendPushNotification(
        userRow.expoPushToken,
        '🏆 You won!',
        `$${payout.toFixed(2)} is being sent to you. Legend.`,
      );
    }

    console.log(
      `[CRON] COMPLETED challengeId=${challenge.id} survivors=${survivors.length} eliminated=${eliminated.length} payoutEach=$${payout.toFixed(2)} — process payouts manually in Stripe dashboard`,
    );
  }
}

async function resolveWeeklyChallenge(challengeId: string, yesterday: Date): Promise<void> {
  const challenge = await db.query.challenges.findFirst({
    where: eq(challenges.id, challengeId),
    with: {
      participants: {
        where: eq(challengeParticipants.status, 'ACTIVE'),
        with: { dailyProgress: true },
      },
    },
  });
  if (!challenge) return;

  const yIdx = weekIndex(challenge.startDate, yesterday);
  if (yIdx < 0) return;

  const weekStart = addDaysUtc(challenge.startDate, yIdx * 7);
  const weekEnd = addDaysUtc(weekStart, 6);
  const isLastDay = yesterday.getTime() === weekEnd.getTime();
  const daysElapsedInWeek =
    Math.floor((yesterday.getTime() - weekStart.getTime()) / 86400000) + 1;
  const daysRemainingInWeek = 7 - daysElapsedInWeek;

  for (const part of challenge.participants) {
    const weekDays = part.dailyProgress.filter(
      (d) => d.date >= weekStart && d.date <= weekEnd,
    );

    const explicitDates = new Set(weekDays.map((d) => d.date.toISOString()));
    const filledWeekDays: Array<{ dayType: 'POWER' | 'ACTIVE' | 'FREE' | 'MISSED' | null }> = [
      ...weekDays.map((d) => ({ dayType: d.dayType })),
    ];
    for (let i = 0; i < daysElapsedInWeek; i++) {
      const d = addDaysUtc(weekStart, i);
      if (!explicitDates.has(d.toISOString())) {
        filledWeekDays.push({ dayType: 'MISSED' });
      }
    }

    const bestCase = [
      ...filledWeekDays,
      ...Array.from({ length: daysRemainingInWeek }, () => ({ dayType: 'POWER' as const })),
    ];
    const canStillPass = weekQuotaSatisfied(challenge, bestCase);

    const [tokenRow] = await db
      .select({ expoPushToken: users.expoPushToken })
      .from(users)
      .where(eq(users.id, part.userId))
      .limit(1);
    const token = tokenRow?.expoPushToken ?? null;

    if (!canStillPass) {
      await eliminateWeekly(part, challenge.title, token);
      continue;
    }

    if (isLastDay) {
      const passed = weekQuotaSatisfied(challenge, filledWeekDays);
      if (!passed) {
        await eliminateWeekly(part, challenge.title, token);
        continue;
      }
      if (token) {
        const totalWeeks = Math.ceil(challenge.durationDays / 7);
        const completedWeeks = yIdx + 1;
        if (completedWeeks < totalWeeks) {
          await sendPushNotification(
            token,
            `✅ Week ${completedWeeks} done!`,
            `${totalWeeks - completedWeeks} weeks to go. Keep at it.`,
          );
        }
      }
    }
  }
}

async function eliminateWeekly(
  part: { id: string; userId: string; commitmentPaid: string; stripePaymentIntentId: string | null },
  challengeTitle: string,
  token: string | null,
): Promise<void> {
  let captured = true;
  try {
    if (part.stripePaymentIntentId && stripe) {
      await stripe.paymentIntents.capture(part.stripePaymentIntentId);
    }
  } catch (err) {
    captured = false;
    console.error(
      `[PAYMENT FAILED] userId=${part.userId} amount=$${Number(part.commitmentPaid).toFixed(2)} intentId=${part.stripePaymentIntentId} — ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }
  await db.transaction(async (tx) => {
    await tx
      .update(challengeParticipants)
      .set({ status: 'ELIMINATED', paymentFailed: !captured })
      .where(eq(challengeParticipants.id, part.id));
    if (captured) {
      await tx.insert(transactions).values({
        userId: part.userId,
        type: 'COMMITMENT_CAPTURE',
        amount: String(part.commitmentPaid),
        stripePaymentIntentId: part.stripePaymentIntentId,
        description: `Eliminated from ${challengeTitle}`,
      });
      await tx
        .update(users)
        .set({
          totalLost: sql`${users.totalLost} + ${part.commitmentPaid}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, part.userId));
    }
  });
  console.log(`[CRON] ELIMINATED (weekly) userId=${part.userId}`);
  if (token) {
    await sendPushNotification(
      token,
      captured ? "💸 You're out" : '💳 Your card failed',
      captured
        ? `You missed this week's quota. $${Number(part.commitmentPaid).toFixed(2)} captured.`
        : "You're out of the challenge. Update your card on the Profile tab.",
    );
  }
}

export async function cancelUnderParticipatedChallenges(
  now: Date = new Date(),
): Promise<void> {
  const today = todayUtc(now);
  const candidates = await db.query.challenges.findMany({
    where: and(eq(challenges.status, 'OPEN'), lte(challenges.startDate, today)),
    with: { participants: { with: { user: true } } },
  });

  for (const c of candidates) {
    if (c.participants.length >= c.minParticipants) continue;
    for (const part of c.participants) {
      if (part.stripePaymentIntentId && stripe) {
        try {
          await stripe.paymentIntents.cancel(part.stripePaymentIntentId);
        } catch (err) {
          console.warn(
            `[CANCEL] cancel hold failed for participant=${part.id}: ${err instanceof Error ? err.message : 'unknown'}`,
          );
        }
      }
      await db.insert(transactions).values({
        userId: part.userId,
        type: 'REFUND',
        amount: String(part.commitmentPaid),
        stripePaymentIntentId: part.stripePaymentIntentId,
        description: `${c.title} cancelled — refunded`,
      });
      if (part.user.expoPushToken) {
        await sendPushNotification(
          part.user.expoPushToken,
          `${c.title} was cancelled`,
          'Not enough participants joined. No charge.',
        );
      }
    }
    await db
      .update(challenges)
      .set({ status: 'CANCELLED', prizePool: '0' })
      .where(eq(challenges.id, c.id));
    console.log(
      `[CRON] CANCELLED challengeId=${c.id} (${c.participants.length}/${c.minParticipants} participants)`,
    );
  }
}

export function startDailyResolutionCron(): void {
  cron.schedule('1 0 * * *', () => {
    Promise.all([runDailyResolution(), cancelUnderParticipatedChallenges()]).catch((err) => {
      console.error('[CRON] resolution error', err);
    });
  });
  console.log('[kaki] daily resolution cron started');
}
