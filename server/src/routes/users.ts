import { Router } from 'express';
import { eq, or, desc, and, gte, lte, inArray } from 'drizzle-orm';

import { requireAuth } from '../middleware/requireAuth';
import { db } from '../lib/db';
import {
  users,
  challenges,
  challengeParticipants,
  dailyProgress,
  transactions,
  stepLogs,
  cheers,
} from '../db/schema';
import { stripe } from '../lib/stripe';
import { evaluateAchievements } from '../lib/achievements';
import { sql } from 'drizzle-orm';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    const isAdmin = Boolean(adminEmail) && user?.email.toLowerCase() === adminEmail;
    const canCreateChallenges = isAdmin || user?.creatorStatus === 'APPROVED';
    res.json({ user: user ?? null, isAdmin, canCreateChallenges });
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const { hasCompletedOnboarding, timezone, name } = req.body as {
      hasCompletedOnboarding?: boolean;
      timezone?: string;
      name?: string;
    };
    const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (typeof hasCompletedOnboarding === 'boolean') patch.hasCompletedOnboarding = hasCompletedOnboarding;
    if (typeof timezone === 'string') patch.timezone = timezone;
    if (typeof name === 'string') patch.name = name;
    const [user] = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, req.auth.userId))
      .returning();
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/me/activity', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const [me] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    if (!me) {
      res.json({ stats: null, participations: [] });
      return;
    }

    const parts = await db.query.challengeParticipants.findMany({
      where: eq(challengeParticipants.userId, me.id),
      with: {
        challenge: true,
        dailyProgress: { orderBy: (d, { asc }) => [asc(d.date)] },
      },
      orderBy: (p, { desc: descFn }) => [descFn(p.joinedAt)],
    });

    const payoutTx = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, me.id));

    const participations = parts.map((p) => {
      const fee = Number(p.commitmentPaid);
      const matchingPayout = payoutTx.find(
        (t) => t.type === 'PRIZE_PAYOUT' && t.description?.includes(p.challenge.title),
      );
      const wonAmount =
        p.status === 'QUALIFIED' && matchingPayout ? Number(matchingPayout.amount) : 0;
      const lostAmount = p.status === 'ELIMINATED' ? fee : 0;
      return {
        id: p.id,
        status: p.status,
        commitmentFee: fee,
        joinedAt: p.joinedAt.toISOString(),
        paymentFailed: p.paymentFailed,
        challenge: {
          id: p.challenge.id,
          title: p.challenge.title,
          dailyStepGoal: p.challenge.dailyStepGoal,
          durationDays: p.challenge.durationDays,
          startDate: p.challenge.startDate.toISOString().slice(0, 10),
          endDate: p.challenge.endDate.toISOString().slice(0, 10),
          status: p.challenge.status,
        },
        dailyProgress: p.dailyProgress.map((d) => ({
          date: d.date.toISOString().slice(0, 10),
          stepsAchieved: d.stepsAchieved,
          goalSteps: d.goalSteps,
          completed: d.completed,
        })),
        wonAmount,
        lostAmount,
      };
    });

    const won = participations.filter((p) => p.status === 'QUALIFIED').length;
    const lost = participations.filter((p) => p.status === 'ELIMINATED').length;
    const earned = participations.reduce((sum, p) => sum + p.wonAmount - p.lostAmount, 0);

    res.json({
      stats: {
        won,
        lost,
        currentStreak: me.currentStreak,
        longestStreak: me.longestStreak,
        earned,
        totalWon: Number(me.totalWon),
        totalLost: Number(me.totalLost),
      },
      participations,
    });
  } catch (err) {
    next(err);
  }
});

usersRouter.delete('/me', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const [me] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    if (!me) {
      res.json({ success: true });
      return;
    }
    const activeCount = await db
      .select({ id: challengeParticipants.id })
      .from(challengeParticipants)
      .where(eq(challengeParticipants.userId, me.id));
    const activeOpen = activeCount.length > 0
      ? await db
          .select({ id: challengeParticipants.id })
          .from(challengeParticipants)
          .where(
            eq(challengeParticipants.userId, me.id),
          )
      : [];
    const stillActive = activeOpen.filter(() => true); // placeholder; real check below

    const activeParts = await db
      .select()
      .from(challengeParticipants)
      .where(eq(challengeParticipants.userId, me.id));
    const active = activeParts.filter((p) => p.status === 'ACTIVE').length;
    if (active > 0) {
      res.status(400).json({
        error: 'active_participations',
        message: `You have ${active} active challenge(s). Wait for them to resolve or get eliminated before deleting your account.`,
      });
      return;
    }
    void stillActive;

    await db.transaction(async (tx) => {
      const parts = await tx
        .select({ id: challengeParticipants.id })
        .from(challengeParticipants)
        .where(eq(challengeParticipants.userId, me.id));
      for (const p of parts) {
        await tx.delete(dailyProgress).where(eq(dailyProgress.participantId, p.id));
      }
      await tx
        .delete(challengeParticipants)
        .where(eq(challengeParticipants.userId, me.id));
      await tx.delete(transactions).where(eq(transactions.userId, me.id));
      await tx.delete(stepLogs).where(eq(stepLogs.userId, me.id));
      await tx.delete(users).where(eq(users.id, me.id));
    });

    if (me.stripeCustomerId) {
      const { stripe: stripeClient } = await import('../lib/stripe');
      if (stripeClient) {
        try {
          await stripeClient.customers.del(me.stripeCustomerId);
        } catch (err) {
          console.warn('[delete-user] Stripe customer delete failed', err);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/me/heatmap', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const [me] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    if (!me) {
      res.json({
        days: [],
        crossStreak: 0,
        longestCrossStreak: 0,
        totalActiveDays: 0,
        categories: [],
      });
      return;
    }

    // Build a 365-day window ending today (in user's local-ish time; we use UTC date strings).
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 364);

    // Find every participation for this user.
    const parts = await db
      .select({ id: challengeParticipants.id, challengeId: challengeParticipants.challengeId })
      .from(challengeParticipants)
      .where(eq(challengeParticipants.userId, me.id));

    const participantIds = parts.map((p) => p.id);
    const challengeIds = Array.from(new Set(parts.map((p) => p.challengeId)));

    // Pull all completed daily progress in the window for those participations.
    const progress =
      participantIds.length === 0
        ? []
        : await db
            .select({
              participantId: dailyProgress.participantId,
              date: dailyProgress.date,
              completed: dailyProgress.completed,
            })
            .from(dailyProgress)
            .where(
              and(
                inArray(dailyProgress.participantId, participantIds),
                gte(dailyProgress.date, start),
                lte(dailyProgress.date, today),
              ),
            );

    // Map participation -> challenge category.
    const challengeRows =
      challengeIds.length === 0
        ? []
        : await db
            .select({ id: challenges.id, category: challenges.category })
            .from(challenges)
            .where(inArray(challenges.id, challengeIds));
    const challengeCategoryById = new Map(challengeRows.map((c) => [c.id, c.category]));
    const partToCategory = new Map(
      parts.map((p) => [p.id, challengeCategoryById.get(p.challengeId) ?? null]),
    );

    // Bucket completions by date (YYYY-MM-DD).
    const dayCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    for (const row of progress) {
      if (!row.completed) continue;
      const key = row.date.toISOString().slice(0, 10);
      dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
      const cat = partToCategory.get(row.participantId);
      if (cat) categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }

    // Generate the 365-day array (ascending).
    const days: Array<{ date: string; count: number }> = [];
    for (let i = 0; i < 365; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, count: dayCounts.get(key) ?? 0 });
    }

    // Cross-challenge current streak: walk backward from today, stop at first gap.
    // If today has no completion yet, allow yesterday to start the streak (so the
    // counter doesn't drop to 0 every morning).
    const completedSet = new Set(
      Array.from(dayCounts.entries())
        .filter(([, n]) => n > 0)
        .map(([k]) => k),
    );
    let crossStreak = 0;
    {
      const cursor = new Date(today);
      const todayKey = today.toISOString().slice(0, 10);
      if (!completedSet.has(todayKey)) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
      while (true) {
        const k = cursor.toISOString().slice(0, 10);
        if (completedSet.has(k)) {
          crossStreak += 1;
          cursor.setUTCDate(cursor.getUTCDate() - 1);
        } else {
          break;
        }
      }
    }

    // Longest cross-challenge streak across the 365-day window.
    let longestCrossStreak = 0;
    {
      let run = 0;
      for (const d of days) {
        if (d.count > 0) {
          run += 1;
          if (run > longestCrossStreak) longestCrossStreak = run;
        } else {
          run = 0;
        }
      }
    }

    const totalActiveDays = completedSet.size;
    const categories = Array.from(categoryCounts.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      days,
      crossStreak,
      longestCrossStreak,
      totalActiveDays,
      categories,
    });
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/me/achievements', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const [me] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    if (!me) {
      res.json({ achievements: [], unlockedCount: 0, totalCount: 0 });
      return;
    }

    // Pull participations with challenge + daily progress for stats.
    const parts = await db.query.challengeParticipants.findMany({
      where: eq(challengeParticipants.userId, me.id),
      with: {
        challenge: true,
        dailyProgress: true,
      },
      orderBy: (p, { asc }) => [asc(p.joinedAt)],
    });

    const wins = parts.filter((p) => p.status === 'QUALIFIED').length;
    const losses = parts.filter((p) => p.status === 'ELIMINATED').length;
    const totalWon = Number(me.totalWon);

    // Distinct categories joined.
    const cats = new Set<string>();
    for (const p of parts) if (p.challenge.category) cats.add(p.challenge.category);

    // Perfect run: any QUALIFIED participation where every day was completed.
    let hasPerfectRun = false;
    for (const p of parts) {
      if (p.status !== 'QUALIFIED') continue;
      const completedDays = p.dailyProgress.filter((d) => d.completed).length;
      if (completedDays >= p.challenge.durationDays) {
        hasPerfectRun = true;
        break;
      }
    }

    // Comeback: at least one ELIMINATED followed (chronologically) by a QUALIFIED.
    let hasComeback = false;
    let sawElim = false;
    for (const p of parts) {
      if (p.status === 'ELIMINATED') sawElim = true;
      if (sawElim && p.status === 'QUALIFIED') {
        hasComeback = true;
        break;
      }
    }

    // Longest cross-challenge streak: reuse logic from heatmap.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 364);

    const partIds = parts.map((p) => p.id);
    const progress =
      partIds.length === 0
        ? []
        : await db
            .select({ date: dailyProgress.date, completed: dailyProgress.completed })
            .from(dailyProgress)
            .where(
              and(
                inArray(dailyProgress.participantId, partIds),
                gte(dailyProgress.date, start),
                lte(dailyProgress.date, today),
              ),
            );
    const completedSet = new Set<string>();
    for (const r of progress) {
      if (r.completed) completedSet.add(r.date.toISOString().slice(0, 10));
    }
    let longestCrossStreak = 0;
    {
      let run = 0;
      const cursor = new Date(start);
      while (cursor.getTime() <= today.getTime()) {
        const k = cursor.toISOString().slice(0, 10);
        if (completedSet.has(k)) {
          run += 1;
          if (run > longestCrossStreak) longestCrossStreak = run;
        } else {
          run = 0;
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    const daysSinceJoin = Math.floor(
      (Date.now() - new Date(me.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );

    const achievements = evaluateAchievements({
      participationsTotal: parts.length,
      wins,
      losses,
      longestCrossStreak,
      totalWon,
      categoriesTouched: cats.size,
      hasPerfectRun,
      daysSinceJoin,
      hasComeback,
    });

    res.json({
      achievements,
      unlockedCount: achievements.filter((a) => a.unlocked).length,
      totalCount: achievements.length,
    });
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/:id/public', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'bad_request' });
      return;
    }
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    // Viewer
    const [viewer] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);

    // Stats from participations.
    const parts = await db.query.challengeParticipants.findMany({
      where: eq(challengeParticipants.userId, target.id),
      with: {
        challenge: true,
        dailyProgress: { orderBy: (d, { desc: descFn }) => [descFn(d.date)] },
      },
      orderBy: (p, { desc: descFn }) => [descFn(p.joinedAt)],
    });
    const wins = parts.filter((p) => p.status === 'QUALIFIED').length;
    const losses = parts.filter((p) => p.status === 'ELIMINATED').length;
    const entered = parts.length;
    const winRate = entered > 0 ? Math.round((wins / entered) * 100) : 0;

    // Distinct categories.
    const cats = new Set<string>();
    for (const p of parts) if (p.challenge.category) cats.add(p.challenge.category);

    // Recent completions (last 10), with cheer counts + did viewer cheer.
    const allCompleted: Array<{
      id: string;
      date: string;
      challengeTitle: string;
      challengeId: string;
      category: string | null;
    }> = [];
    for (const p of parts) {
      for (const d of p.dailyProgress) {
        if (!d.completed) continue;
        allCompleted.push({
          id: d.id,
          date: d.date.toISOString().slice(0, 10),
          challengeTitle: p.challenge.title,
          challengeId: p.challenge.id,
          category: p.challenge.category,
        });
      }
    }
    allCompleted.sort((a, b) => (a.date < b.date ? 1 : -1));
    const recent = allCompleted.slice(0, 10);

    // Cheer counts + viewer state for each recent completion.
    const recentIds = recent.map((r) => r.id);
    let cheerRows: Array<{ dailyProgressId: string; fromUserId: string }> = [];
    if (recentIds.length > 0) {
      cheerRows = await db
        .select({ dailyProgressId: cheers.dailyProgressId, fromUserId: cheers.fromUserId })
        .from(cheers)
        .where(inArray(cheers.dailyProgressId, recentIds));
    }
    const countByProg = new Map<string, number>();
    const viewerCheered = new Set<string>();
    for (const c of cheerRows) {
      countByProg.set(c.dailyProgressId, (countByProg.get(c.dailyProgressId) ?? 0) + 1);
      if (viewer && c.fromUserId === viewer.id) viewerCheered.add(c.dailyProgressId);
    }

    // Achievements unlocked.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 364);
    const partIds = parts.map((p) => p.id);
    const progress =
      partIds.length === 0
        ? []
        : await db
            .select({ date: dailyProgress.date, completed: dailyProgress.completed })
            .from(dailyProgress)
            .where(
              and(
                inArray(dailyProgress.participantId, partIds),
                gte(dailyProgress.date, start),
                lte(dailyProgress.date, today),
              ),
            );
    const completedSet = new Set<string>();
    for (const r of progress) {
      if (r.completed) completedSet.add(r.date.toISOString().slice(0, 10));
    }
    let longestCrossStreak = 0;
    {
      let run = 0;
      const cursor = new Date(start);
      while (cursor.getTime() <= today.getTime()) {
        const k = cursor.toISOString().slice(0, 10);
        if (completedSet.has(k)) {
          run += 1;
          if (run > longestCrossStreak) longestCrossStreak = run;
        } else run = 0;
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    let hasPerfectRun = false;
    for (const p of parts) {
      if (p.status !== 'QUALIFIED') continue;
      const done = p.dailyProgress.filter((d) => d.completed).length;
      if (done >= p.challenge.durationDays) { hasPerfectRun = true; break; }
    }
    let hasComeback = false;
    {
      let sawElim = false;
      for (const p of [...parts].reverse()) { // ascending by joinedAt
        if (p.status === 'ELIMINATED') sawElim = true;
        if (sawElim && p.status === 'QUALIFIED') { hasComeback = true; break; }
      }
    }
    const daysSinceJoin = Math.floor(
      (Date.now() - new Date(target.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    const achievements = evaluateAchievements({
      participationsTotal: entered,
      wins,
      losses,
      longestCrossStreak,
      totalWon: Number(target.totalWon),
      categoriesTouched: cats.size,
      hasPerfectRun,
      daysSinceJoin,
      hasComeback,
    });
    const unlocked = achievements.filter((a) => a.unlocked);

    // Total cheers received by this user (across all completions).
    const [cheersTotalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cheers)
      .where(eq(cheers.toUserId, target.id));
    const cheersReceived = cheersTotalRow?.count ?? 0;

    res.json({
      user: {
        id: target.id,
        name: target.name,
        avatarUrl: target.avatarUrl,
        memberSince: target.createdAt.toISOString(),
        currentStreak: target.currentStreak,
        longestStreak: target.longestStreak,
      },
      stats: {
        entered,
        wins,
        losses,
        winRate,
        longestCrossStreak,
        cheersReceived,
      },
      achievements: unlocked.map((a) => ({
        id: a.id,
        title: a.title,
        emoji: a.emoji,
      })),
      recentCompletions: recent.map((r) => ({
        id: r.id,
        date: r.date,
        challengeTitle: r.challengeTitle,
        challengeId: r.challengeId,
        category: r.category,
        cheerCount: countByProg.get(r.id) ?? 0,
        viewerCheered: viewerCheered.has(r.id),
      })),
      isSelf: viewer?.id === target.id,
    });
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/me/apply-creator', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const { bio } = req.body as { bio?: string };
    const [me] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    if (!me) {
      res.status(404).json({ error: 'no_user' });
      return;
    }
    if (me.creatorStatus === 'APPROVED') {
      res.status(400).json({ error: 'already_approved' });
      return;
    }
    const [user] = await db
      .update(users)
      .set({
        creatorStatus: 'APPLIED',
        creatorAppliedAt: new Date(),
        creatorBio: typeof bio === 'string' ? bio.slice(0, 500) : me.creatorBio,
        updatedAt: new Date(),
      })
      .where(eq(users.id, me.id))
      .returning();
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/push-token', requireAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.status(500).json({ error: 'server_misconfigured' });
      return;
    }
    const { token } = req.body as { token?: string };
    if (!token) {
      res.status(400).json({ error: 'bad_request', message: 'token required' });
      return;
    }
    await db
      .update(users)
      .set({ expoPushToken: token, updatedAt: new Date() })
      .where(eq(users.id, req.auth.userId));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Hint to avoid unused import warnings if any path is dead code.
void desc;
