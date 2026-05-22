import { Router } from 'express';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { requireAuth } from '../middleware/requireAuth';
import { db } from '../lib/db';
import {
  users,
  cheers,
  dailyProgress,
  challengeParticipants,
} from '../db/schema';

export const cheersRouter = Router();

/**
 * POST /daily-progress/:id/cheer
 * Idempotent: cheering again returns the same row.
 */
cheersRouter.post('/daily-progress/:id/cheer', requireAuth, async (req, res, next) => {
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
    const [me] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    if (!me) {
      res.status(404).json({ error: 'no_user' });
      return;
    }
    // Find the target dailyProgress + its owner.
    const [target] = await db
      .select({
        id: dailyProgress.id,
        completed: dailyProgress.completed,
        participantId: dailyProgress.participantId,
      })
      .from(dailyProgress)
      .where(eq(dailyProgress.id, id))
      .limit(1);
    if (!target) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (!target.completed) {
      res.status(400).json({ error: 'not_completed', message: 'Can only cheer completed days.' });
      return;
    }
    const [part] = await db
      .select({ userId: challengeParticipants.userId })
      .from(challengeParticipants)
      .where(eq(challengeParticipants.id, target.participantId))
      .limit(1);
    if (!part) {
      res.status(404).json({ error: 'no_participant' });
      return;
    }
    if (part.userId === me.id) {
      res.status(400).json({ error: 'cannot_cheer_self' });
      return;
    }

    // Insert; on conflict do nothing (idempotent).
    await db
      .insert(cheers)
      .values({ fromUserId: me.id, toUserId: part.userId, dailyProgressId: target.id })
      .onConflictDoNothing();

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cheers)
      .where(eq(cheers.dailyProgressId, target.id));

    res.json({ ok: true, cheerCount: countRow?.count ?? 0, viewerCheered: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /daily-progress/:id/cheer — un-cheer.
 */
cheersRouter.delete('/daily-progress/:id/cheer', requireAuth, async (req, res, next) => {
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
    const [me] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    if (!me) {
      res.status(404).json({ error: 'no_user' });
      return;
    }
    await db
      .delete(cheers)
      .where(and(eq(cheers.dailyProgressId, id), eq(cheers.fromUserId, me.id)));

    const [delCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cheers)
      .where(eq(cheers.dailyProgressId, id));

    res.json({ ok: true, cheerCount: delCountRow?.count ?? 0, viewerCheered: false });
  } catch (err) {
    next(err);
  }
});

/**
 * Helper used by other routes: return cheer counts + viewer-cheered set for a
 * batch of dailyProgress ids.
 */
export async function fetchCheerInfo(progressIds: string[], viewerId: string | null) {
  if (progressIds.length === 0) return { count: new Map<string, number>(), viewer: new Set<string>() };
  const rows = await db
    .select({ dailyProgressId: cheers.dailyProgressId, fromUserId: cheers.fromUserId })
    .from(cheers)
    .where(inArray(cheers.dailyProgressId, progressIds));
  const count = new Map<string, number>();
  const viewer = new Set<string>();
  for (const r of rows) {
    count.set(r.dailyProgressId, (count.get(r.dailyProgressId) ?? 0) + 1);
    if (viewerId && r.fromUserId === viewerId) viewer.add(r.dailyProgressId);
  }
  return { count, viewer };
}
