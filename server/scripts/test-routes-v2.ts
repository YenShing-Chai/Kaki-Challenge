/**
 * Integration smoke test for the new /api/challenges/* routes.
 *
 * Boots an in-process Express app and hits the endpoints with supertest-style
 * raw http requests. Doesn't touch real DB beyond reading: each test gives
 * a clear go/no-go on routing + payload validation.
 *
 * Run: npx tsx scripts/test-routes-v2.ts
 */

import 'dotenv/config';
import http from 'http';
import { eq } from 'drizzle-orm';

import { db } from '../src/lib/db';
import { users } from '../src/db/schema';
import { signJwt } from '../src/lib/jwt';

import express from 'express';
import { challengesV2Router } from '../src/routes/challengesV2';
import { adminChallengesRouter } from '../src/routes/adminChallenges';

let passed = 0;
let failed = 0;

function eq2<T>(actual: T, expected: T, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}
function truthy(actual: unknown, label: string) {
  if (actual) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label} — got ${JSON.stringify(actual)}`); }
}
function section(name: string) { console.log(`\n── ${name} ──`); }

async function request(
  port: number,
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(data ? { 'content-length': Buffer.byteLength(data).toString() } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    };
    const req = http.request({ host: 'localhost', port, method, path, headers }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try {
          const parsed = buf ? JSON.parse(buf) : null;
          resolve({ status: res.statusCode ?? 0, body: parsed });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: buf });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // Build mini-app (don't touch the real cron jobs)
  const app = express();
  app.use(express.json());
  app.use('/api/challenges', challengesV2Router);
  app.use('/admin', adminChallengesRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const msg = err instanceof Error ? err.message : 'internal';
    console.error('[test-app] error', err);
    res.status(500).json({ error: 'internal', message: msg });
  });

  const server = app.listen(0); // random port
  const port = (server.address() as { port: number }).port;
  console.log(`Test app on :${port}`);

  // Pick first real user from DB to sign a JWT (we need real user.id for auth)
  const [user] = await db.select({ id: users.id, email: users.email }).from(users).limit(1);
  if (!user) {
    console.error('No users in DB — cannot run integration test.');
    server.close();
    process.exit(1);
  }
  const token = signJwt(user.id);
  console.log(`Using user: ${user.email} (${user.id})`);

  // ─── Validate ─────────────────────────────────────────────────────────

  section('POST /api/challenges/validate');

  // Unauthorized
  {
    const r = await request(port, 'POST', '/api/challenges/validate', {});
    eq2(r.status, 401, 'no token = 401');
  }

  // Invalid payload
  {
    const r = await request(port, 'POST', '/api/challenges/validate', {}, token);
    eq2(r.status, 400, 'empty payload = 400');
  }

  // Valid private friends fitness — should pass
  {
    const r = await request(
      port,
      'POST',
      '/api/challenges/validate',
      {
        title: 'Family step streak',
        description: 'Daily 8k steps for a week',
        creatorIntent: 'FRIENDS',
        category: 'FITNESS',
        visibility: 'PRIVATE',
        rewardType: 'BADGE',
        verificationMethod: 'PHOTO_UPLOAD',
        winCondition: { type: 'REACH_TARGET', targetValue: 8000, requiredCount: 7, allowedMisses: 1 },
        startAt: '2026-06-01T00:00:00Z',
        endAt: '2026-06-08T00:00:00Z',
      },
      token,
    );
    eq2(r.status, 200, 'valid request = 200');
    truthy((r.body as { canCreate?: boolean }).canCreate, 'canCreate = true');
  }

  // 20 shots — should block
  {
    const r = await request(
      port,
      'POST',
      '/api/challenges/validate',
      {
        title: 'Who can drink 20 shots fastest',
        creatorIntent: 'FRIENDS',
        category: 'SOCIAL',
        visibility: 'PRIVATE',
        rewardType: 'BADGE',
        verificationMethod: 'PHOTO_UPLOAD',
        winCondition: { type: 'FASTEST_COMPLETION' },
        startAt: '2026-06-01T00:00:00Z',
        endAt: '2026-06-08T00:00:00Z',
      },
      token,
    );
    eq2(r.status, 200, '20 shots returns 200 (not 4xx — validate is informational)');
    const b = r.body as { canCreate?: boolean; suggestedAlternative?: { template: string } };
    eq2(b.canCreate, false, '20 shots canCreate=false');
    truthy(b.suggestedAlternative, 'suggestedAlternative present');
  }

  // Winner Pool + self-declaration — should block
  {
    const r = await request(
      port,
      'POST',
      '/api/challenges/validate',
      {
        title: 'Family steps WP',
        creatorIntent: 'FRIENDS',
        category: 'FITNESS',
        visibility: 'PRIVATE',
        rewardType: 'WINNER_POOL',
        verificationMethod: 'SELF_DECLARATION',
        winCondition: { type: 'REACH_TARGET', targetValue: 8000 },
        winnerPool: {
          entryContributionAmount: 10,
          distributionMethod: 'ALL_COMPLETERS_EQUAL_SPLIT',
          participantMinimum: 2,
          participantMaximum: 8,
          termsAccepted: true,
        },
        startAt: '2026-06-01T00:00:00Z',
        endAt: '2026-06-08T00:00:00Z',
      },
      token,
    );
    const b = r.body as { canCreate?: boolean; blockReason?: string };
    eq2(b.canCreate, false, 'WP+self-declare blocked');
    truthy(b.blockReason?.includes('self-declaration'), 'reason mentions self-declaration');
  }

  // Winner Pool RM 60 — exceeds cap
  {
    const r = await request(
      port,
      'POST',
      '/api/challenges/validate',
      {
        title: 'Family steps WP',
        creatorIntent: 'FRIENDS',
        category: 'FITNESS',
        visibility: 'PRIVATE',
        rewardType: 'WINNER_POOL',
        verificationMethod: 'PHOTO_UPLOAD',
        winCondition: { type: 'REACH_TARGET', targetValue: 8000 },
        winnerPool: {
          entryContributionAmount: 60,
          distributionMethod: 'ALL_COMPLETERS_EQUAL_SPLIT',
          participantMinimum: 2,
          participantMaximum: 8,
          termsAccepted: true,
        },
        startAt: '2026-06-01T00:00:00Z',
        endAt: '2026-06-08T00:00:00Z',
      },
      token,
    );
    const b = r.body as { canCreate?: boolean; blockReason?: string };
    eq2(b.canCreate, false, 'RM 60 entry blocked');
  }

  // ─── Create — full Winner Pool challenge ─────────────────────────────────

  section('POST /api/challenges (Winner Pool path)');

  // First mark the test user as age-verified + MY jurisdiction
  await db
    .update(users)
    .set({ isAgeVerified: true, jurisdiction: 'MY', trustScore: 90 })
    .where(eq(users.id, user.id));

  let createdId: string | null = null;
  {
    const r = await request(
      port,
      'POST',
      '/api/challenges',
      {
        title: 'Integration test — WP fitness',
        creatorIntent: 'FRIENDS',
        category: 'FITNESS',
        visibility: 'PRIVATE',
        rewardType: 'WINNER_POOL',
        verificationMethod: 'PEER_VERIFICATION', // PHOTO_UPLOAD not allowed for WP per §18.2
        winCondition: { type: 'REACH_TARGET', targetValue: 8000, requiredCount: 7, allowedMisses: 1 },
        winnerPool: {
          entryContributionAmount: 10,
          distributionMethod: 'ALL_COMPLETERS_EQUAL_SPLIT',
          participantMinimum: 2,
          participantMaximum: 8,
          termsAccepted: true,
        },
        startAt: '2026-06-01T00:00:00Z',
        endAt: '2026-06-08T00:00:00Z',
        timezone: 'Asia/Kuala_Lumpur',
      },
      token,
    );
    if (r.status !== 201) console.log('     create response:', JSON.stringify(r.body));
    eq2(r.status, 201, 'create = 201');
    const b = r.body as { id?: string; lifecycle?: string; moderationStatus?: string };
    truthy(b.id, 'returned id');
    eq2(b.lifecycle, 'PENDING_REVIEW', 'WP challenge starts in PENDING_REVIEW');
    eq2(b.moderationStatus, 'PENDING_REVIEW', 'moderation = PENDING_REVIEW');
    createdId = b.id ?? null;
  }

  // ─── Verify schema writes ────────────────────────────────────────────────

  if (createdId) {
    section('Schema writes verification');
    const { challenges, challengeRules, challengeWinnerPools, challengeAuditLogs } = await import('../src/db/schema');
    const [ch] = await db.select().from(challenges).where(eq(challenges.id, createdId)).limit(1);
    truthy(ch, 'challenge row exists');
    eq2(ch?.rewardType, 'WINNER_POOL', 'rewardType set');
    eq2(ch?.creatorIntent, 'FRIENDS', 'creatorIntent set');
    eq2(ch?.lifecycle, 'PENDING_REVIEW', 'lifecycle set');

    const [rule] = await db.select().from(challengeRules).where(eq(challengeRules.challengeId, createdId)).limit(1);
    truthy(rule, 'rule row exists');
    eq2(rule?.winConditionType, 'REACH_TARGET', 'rule win condition');
    eq2(Number(rule?.targetValue), 8000, 'rule target');
    eq2(rule?.requiredCount, 7, 'rule required count');

    const [pool] = await db.select().from(challengeWinnerPools).where(eq(challengeWinnerPools.challengeId, createdId)).limit(1);
    truthy(pool, 'pool row exists');
    eq2(Number(pool?.entryContributionAmount), 10, 'pool entry amount');
    eq2(pool?.distributionMethod, 'ALL_COMPLETERS_EQUAL_SPLIT', 'pool distribution');
    eq2(pool?.manualApprovalRequired, true, 'WP requires manual approval');

    const audits = await db.select().from(challengeAuditLogs).where(eq(challengeAuditLogs.challengeId, createdId));
    truthy(audits.length >= 1, `at least 1 audit log entry (got ${audits.length})`);
    truthy(audits.some((a) => a.action === 'CHALLENGE_CREATED'), 'CHALLENGE_CREATED logged');
  }

  // ─── Cleanup: delete the test challenge ──────────────────────────────────

  if (createdId) {
    const { challenges, challengeRules, challengeWinnerPools, challengeAuditLogs } = await import('../src/db/schema');
    await db.delete(challengeAuditLogs).where(eq(challengeAuditLogs.challengeId, createdId));
    await db.delete(challengeWinnerPools).where(eq(challengeWinnerPools.challengeId, createdId));
    await db.delete(challengeRules).where(eq(challengeRules.challengeId, createdId));
    await db.delete(challenges).where(eq(challenges.id, createdId));
    console.log(`\nCleaned up test challenge ${createdId}`);
  }

  server.close();

  console.log('\n' + '═'.repeat(60));
  console.log(`Passed: ${passed}   Failed: ${failed}`);
  console.log('═'.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
