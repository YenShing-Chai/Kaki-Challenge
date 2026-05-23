import 'dotenv/config';
import postgres from 'postgres';

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const sql = postgres(url, { prepare: false, max: 1 });

  console.log('Verifying schema on', url.split('@')[1]?.split('/')[0]);

  const newTables = [
    'ChallengeRule',
    'ChallengeSubmission',
    'ChallengePeerReview',
    'ChallengeDispute',
    'ChallengeAuditLog',
    'ChallengeWinnerPool',
    'ChallengePoolContribution',
    'ChallengePoolPayout',
  ];
  console.log('\n── New tables ──');
  for (const t of newTables) {
    const r = await sql<Array<{ count: string }>>`
      SELECT COUNT(*)::text AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${t}
    `;
    console.log(`  ${r[0].count === '1' ? '✓' : '✗'} ${t}`);
  }

  const newEnums = [
    'CreatorIntent',
    'ChallengeCategoryV2',
    'RiskLevel',
    'ModerationStatus',
    'WinCondition',
    'VerificationLevel',
    'ChallengeLifecycle',
    'RewardType',
    'Visibility',
    'ResultStatus',
    'SubmissionStatus',
    'DisputeReason',
    'DisputeStatus',
    'DistributionMethod',
    'ContributionStatus',
    'PayoutStatus',
    'NoWinnerRule',
  ];
  console.log('\n── New enums ──');
  for (const e of newEnums) {
    const r = await sql<Array<{ count: string }>>`
      SELECT COUNT(*)::text AS count FROM pg_type
      WHERE typname = ${e}
    `;
    console.log(`  ${r[0].count === '1' ? '✓' : '✗'} ${e}`);
  }

  const challengeNewCols = [
    'creatorIntent',
    'categoryV2',
    'visibility',
    'lifecycle',
    'riskLevel',
    'moderationStatus',
    'rewardType',
    'startAt',
    'endAt',
    'disputeWindowHours',
  ];
  console.log('\n── Challenge new columns ──');
  for (const c of challengeNewCols) {
    const r = await sql<Array<{ count: string }>>`
      SELECT COUNT(*)::text AS count FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Challenge' AND column_name = ${c}
    `;
    console.log(`  ${r[0].count === '1' ? '✓' : '✗'} ${c}`);
  }

  const userNewCols = [
    'trustScore',
    'fraudFlags',
    'kakiPoints',
    'isAgeVerified',
    'jurisdiction',
    'isSuspended',
  ];
  console.log('\n── User new columns ──');
  for (const c of userNewCols) {
    const r = await sql<Array<{ count: string }>>`
      SELECT COUNT(*)::text AS count FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'User' AND column_name = ${c}
    `;
    console.log(`  ${r[0].count === '1' ? '✓' : '✗'} ${c}`);
  }

  // Existing data preserved?
  const userCount = await sql<Array<{ n: number }>>`SELECT COUNT(*)::int AS n FROM "User"`;
  const oldChallengeCount = await sql<Array<{ n: number }>>`SELECT COUNT(*)::int AS n FROM "Challenge"`;
  console.log('\n── Row counts (existing data preserved) ──');
  console.log(`  Users:           ${userCount[0].n}`);
  console.log(`  Old challenges:  ${oldChallengeCount[0].n}`);

  await sql.end();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
