/**
 * Wipe dev challenge data before PRD-aligned backend rewrite.
 *
 * What this nukes:
 *   - All cheers
 *   - All daily progress
 *   - All step logs
 *   - All challenge participants
 *   - All transactions
 *   - All challenges
 *   - All new pool/submission/dispute tables (empty anyway, just being explicit)
 *
 * What this preserves:
 *   - All users (auth credentials + Stripe customer IDs stay intact)
 *
 * Why: the data was created against the legacy GameFormat/VerificationMethod
 * schema and can't be cleanly migrated to the new 11-code win-condition system.
 * Better to start fresh.
 */

import 'dotenv/config';
import postgres from 'postgres';

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const sql = postgres(url, { prepare: false, max: 1 });
  const host = url.split('@')[1]?.split('/')[0];
  console.log(`Wiping dev challenge data on ${host}…`);

  try {
    // FK-respecting order: leaves first, then trunk
    await sql.begin(async (tx) => {
      // New tables (likely empty but truncate for safety)
      await tx`TRUNCATE TABLE "ChallengePoolPayout" CASCADE`;
      await tx`TRUNCATE TABLE "ChallengePoolContribution" CASCADE`;
      await tx`TRUNCATE TABLE "ChallengeWinnerPool" CASCADE`;
      await tx`TRUNCATE TABLE "ChallengePeerReview" CASCADE`;
      await tx`TRUNCATE TABLE "ChallengeAuditLog" CASCADE`;
      await tx`TRUNCATE TABLE "ChallengeDispute" CASCADE`;
      await tx`TRUNCATE TABLE "ChallengeSubmission" CASCADE`;
      await tx`TRUNCATE TABLE "ChallengeRule" CASCADE`;

      // Legacy tables with dev data
      await tx`TRUNCATE TABLE "Cheer" CASCADE`;
      await tx`TRUNCATE TABLE "DailyProgress" CASCADE`;
      await tx`TRUNCATE TABLE "StepLog" CASCADE`;
      await tx`TRUNCATE TABLE "ChallengeParticipant" CASCADE`;
      await tx`TRUNCATE TABLE "Transaction" CASCADE`;
      await tx`TRUNCATE TABLE "Challenge" CASCADE`;
    });

    // Verify
    const counts = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM "Challenge"`,
      sql`SELECT COUNT(*)::int AS n FROM "ChallengeParticipant"`,
      sql`SELECT COUNT(*)::int AS n FROM "DailyProgress"`,
      sql`SELECT COUNT(*)::int AS n FROM "Transaction"`,
      sql`SELECT COUNT(*)::int AS n FROM "Cheer"`,
      sql`SELECT COUNT(*)::int AS n FROM "User"`,
    ]);

    console.log('Post-wipe row counts:');
    console.log(`  Challenge:            ${counts[0][0].n}`);
    console.log(`  ChallengeParticipant: ${counts[1][0].n}`);
    console.log(`  DailyProgress:        ${counts[2][0].n}`);
    console.log(`  Transaction:          ${counts[3][0].n}`);
    console.log(`  Cheer:                ${counts[4][0].n}`);
    console.log(`  User (preserved):     ${counts[5][0].n}`);

    console.log('\nDone.');
  } finally {
    await sql.end();
  }

  process.exit(0);
})().catch((e) => {
  console.error('Wipe failed:', e);
  process.exit(1);
});
