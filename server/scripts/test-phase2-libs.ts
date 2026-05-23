/**
 * Smoke tests for Phase 2 foundation libraries.
 * Runs via: npx tsx scripts/test-phase2-libs.ts
 *
 * No test framework — just plain asserts + colored output. Keeps tooling
 * surface minimal for a solo project. Exit code != 0 on any failure.
 */

import {
  evaluateAll,
  evaluateOne,
  finalize,
  validateRule,
  WIN_CONDITIONS,
  type ParticipantSnapshot,
  type ChallengeRuleInputs,
} from '../src/lib/winConditions';

import {
  VERIFICATION_LEVELS,
  checkRewardVerificationCompatibility,
  computeConfidence,
  classifySubmission,
  resolvePeerOutcome,
  suggestVerification,
  DEFAULT_AUTO_APPROVE_THRESHOLD,
} from '../src/lib/verification';

import { evaluateModeration, __forTests } from '../src/lib/moderation';

import { computeTrust, policyForTier, tierFromScore } from '../src/lib/trustScore';

let passed = 0;
let failed = 0;

function eq<T>(actual: T, expected: T, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`);
    console.log(`     expected: ${JSON.stringify(expected)}`);
    console.log(`     actual:   ${JSON.stringify(actual)}`);
  }
}

function truthy(actual: unknown, label: string) {
  if (actual) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label} — got falsy: ${JSON.stringify(actual)}`);
  }
}

function falsy(actual: unknown, label: string) {
  if (!actual) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label} — expected falsy, got: ${JSON.stringify(actual)}`);
  }
}

function section(name: string) {
  console.log(`\n── ${name} ──`);
}

// Helper for participant snapshots
function p(over: Partial<ParticipantSnapshot> & { id: string }): ParticipantSnapshot {
  return {
    participantId: over.id,
    userId: `user-${over.id}`,
    completionCount: 0,
    progressValue: 0,
    missedCount: 0,
    approvedSubmissionCount: 0,
    disqualified: false,
    hasPendingProof: false,
    ...over,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Win conditions
// ═══════════════════════════════════════════════════════════════════════════

section('Win conditions — basic per-code');

// COMPLETE_ALL
{
  const rule: ChallengeRuleInputs = { winConditionType: 'COMPLETE_ALL', requiredCount: 5 };
  eq(evaluateOne(p({ id: 'a', approvedSubmissionCount: 5 }), rule).resultStatus, 'SUCCESS', 'COMPLETE_ALL hit');
  eq(evaluateOne(p({ id: 'b', approvedSubmissionCount: 4 }), rule).resultStatus, 'FAILED', 'COMPLETE_ALL miss');
}

// REACH_TARGET cumulative
{
  const rule: ChallengeRuleInputs = { winConditionType: 'REACH_TARGET', targetValue: 500 };
  eq(evaluateOne(p({ id: 'a', progressValue: 500 }), rule).resultStatus, 'SUCCESS', 'REACH_TARGET hit');
  eq(evaluateOne(p({ id: 'b', progressValue: 499 }), rule).resultStatus, 'FAILED', 'REACH_TARGET miss');
}

// REACH_TARGET daily streak
{
  const rule: ChallengeRuleInputs = {
    winConditionType: 'REACH_TARGET',
    targetValue: 8000,
    requiredCount: 7,
    allowedMisses: 1,
  };
  eq(
    evaluateOne(p({ id: 'a', completionCount: 7, missedCount: 0 }), rule).resultStatus,
    'SUCCESS',
    'REACH_TARGET streak hit',
  );
  eq(
    evaluateOne(p({ id: 'b', completionCount: 6, missedCount: 1 }), rule).resultStatus,
    'FAILED',
    'REACH_TARGET streak completed < required',
  );
  eq(
    evaluateOne(p({ id: 'c', completionCount: 7, missedCount: 2 }), rule).resultStatus,
    'FAILED',
    'REACH_TARGET streak too many misses',
  );
}

// STAY_BELOW_LIMIT
{
  const rule: ChallengeRuleInputs = { winConditionType: 'STAY_BELOW_LIMIT', limitValue: 300 };
  eq(evaluateOne(p({ id: 'a', progressValue: 250 }), rule).resultStatus, 'SUCCESS', 'STAY_BELOW under');
  eq(evaluateOne(p({ id: 'b', progressValue: 350 }), rule).resultStatus, 'FAILED', 'STAY_BELOW over');
}

// Disqualified short-circuits
{
  const rule: ChallengeRuleInputs = { winConditionType: 'COMPLETE_ALL', requiredCount: 5 };
  eq(
    evaluateOne(p({ id: 'a', approvedSubmissionCount: 5, disqualified: true }), rule).resultStatus,
    'DISQUALIFIED',
    'DQ wins over success',
  );
}

// Pending proof short-circuits
{
  const rule: ChallengeRuleInputs = { winConditionType: 'COMPLETE_ALL', requiredCount: 5 };
  eq(
    evaluateOne(p({ id: 'a', approvedSubmissionCount: 5, hasPendingProof: true }), rule).resultStatus,
    'PENDING_REVIEW',
    'Pending proof defers result',
  );
}

section('Win conditions — ranking + cohort');

// RANK_TOP_N
{
  const rule: ChallengeRuleInputs = { winConditionType: 'RANK_TOP_N', winnerCount: 2 };
  const snaps = [
    p({ id: 'a', progressValue: 100 }),
    p({ id: 'b', progressValue: 200 }),
    p({ id: 'c', progressValue: 150 }),
    p({ id: 'd', progressValue: 50 }),
  ];
  const verdicts = evaluateAll(snaps, rule);
  const byId = Object.fromEntries(verdicts.map((v) => [v.participantId, v]));
  eq(byId.b.resultStatus, 'SUCCESS', 'RANK_TOP_N rank 1 wins');
  eq(byId.c.resultStatus, 'SUCCESS', 'RANK_TOP_N rank 2 wins');
  eq(byId.a.resultStatus, 'FAILED', 'RANK_TOP_N rank 3 loses');
  eq(byId.b.finalRank, 1, 'RANK_TOP_N rank assigned');
}

// FASTEST_COMPLETION
{
  const rule: ChallengeRuleInputs = { winConditionType: 'FASTEST_COMPLETION' };
  const snaps = [
    p({ id: 'a', firstCompletedAt: 1000 }),
    p({ id: 'b', firstCompletedAt: 500 }),
    p({ id: 'c' }), // no completion
  ];
  const v = evaluateAll(snaps, rule);
  const byId = Object.fromEntries(v.map((x) => [x.participantId, x]));
  eq(byId.b.resultStatus, 'SUCCESS', 'FASTEST winner');
  eq(byId.a.resultStatus, 'FAILED', 'FASTEST 2nd loses');
  eq(byId.c.resultStatus, 'FAILED', 'FASTEST never-completed loses');
}

// TEAM_TARGET
{
  const rule: ChallengeRuleInputs = {
    winConditionType: 'TEAM_TARGET',
    teamTargetValue: 100,
    individualMinimumValue: 10,
  };
  const snaps = [
    p({ id: 'a', teamId: 'T1', progressValue: 60 }),
    p({ id: 'b', teamId: 'T1', progressValue: 50 }),
    p({ id: 'c', teamId: 'T2', progressValue: 200 }),
    p({ id: 'd', teamId: 'T2', progressValue: 5 }), // below individual min
  ];
  const v = evaluateAll(snaps, rule);
  const byId = Object.fromEntries(v.map((x) => [x.participantId, x]));
  eq(byId.a.resultStatus, 'SUCCESS', 'TEAM_TARGET sum 110 ≥ 100');
  eq(byId.c.resultStatus, 'SUCCESS', 'TEAM_TARGET other team also success');
  eq(byId.d.resultStatus, 'FAILED', 'TEAM_TARGET individual below min');
}

section('Win conditions — rule validation');

eq(validateRule({ winConditionType: 'REACH_TARGET', targetValue: 8000 }), [], 'valid REACH_TARGET');
truthy(
  validateRule({ winConditionType: 'REACH_TARGET' }).some((e) => e.includes('target_value')),
  'REACH_TARGET missing target',
);
truthy(
  validateRule({ winConditionType: 'RANK_TOP_PERCENT', winnerPercentage: 150 }).some((e) => e.includes('winner_percentage')),
  'RANK_TOP_PERCENT invalid %',
);

eq(WIN_CONDITIONS.JUDGED_BEST.needsJudges, true, 'JUDGED_BEST meta needs judges');

// ═══════════════════════════════════════════════════════════════════════════
// Verification
// ═══════════════════════════════════════════════════════════════════════════

section('Verification — reward gating');

eq(
  checkRewardVerificationCompatibility('WINNER_POOL', 'SELF_DECLARATION'),
  'Winner Pool challenges cannot use self-declaration verification.',
  'Winner Pool + self-declaration blocked',
);
eq(
  checkRewardVerificationCompatibility('WINNER_POOL', 'PEER_VERIFICATION'),
  null,
  'Winner Pool + peer OK',
);
eq(
  checkRewardVerificationCompatibility('VOUCHER', 'PHOTO_UPLOAD'),
  'Reward "VOUCHER" requires stronger verification than Photo proof.',
  'Voucher needs > photo',
);
eq(checkRewardVerificationCompatibility('BADGE', 'SELF_DECLARATION'), null, 'Badge + self-declare OK');
eq(checkRewardVerificationCompatibility('RANDOM_PAID_PRIZE', 'PARTNER_VERIFIED'), 'Random paid prize draws are not supported.', 'Random paid prize always blocked');

section('Verification — confidence scoring');

eq(VERIFICATION_LEVELS.SELF_DECLARATION.baselineConfidence, 20, 'Self-declare baseline');
eq(VERIFICATION_LEVELS.RECEIPT_POS_API.baselineConfidence, 90, 'API baseline');
truthy(
  computeConfidence({ level: 'PHOTO_UPLOAD', exifOk: true, onTime: true }) >
    VERIFICATION_LEVELS.PHOTO_UPLOAD.baselineConfidence,
  'Photo+EXIF+ontime > baseline',
);

eq(classifySubmission(80), 'AUTO_APPROVED', 'Classify 80 = auto');
eq(classifySubmission(40), 'PENDING_REVIEW', 'Classify 40 = review');
eq(classifySubmission(DEFAULT_AUTO_APPROVE_THRESHOLD), 'AUTO_APPROVED', 'Threshold boundary');

section('Verification — peer outcome');

eq(resolvePeerOutcome({ approvals: 2, rejections: 0, selfReviewBlocked: false, hoursSinceSubmission: 5 }), 'APPROVED', 'Peer 2 approvals = approved');
eq(resolvePeerOutcome({ approvals: 1, rejections: 0, selfReviewBlocked: false, hoursSinceSubmission: 5 }), 'PENDING_REVIEW', 'Peer 1 approval = pending');
eq(resolvePeerOutcome({ approvals: 0, rejections: 2, selfReviewBlocked: false, hoursSinceSubmission: 5 }), 'REJECTED', 'Peer 2 rejections = rejected');
eq(resolvePeerOutcome({ approvals: 1, rejections: 0, selfReviewBlocked: false, hoursSinceSubmission: 30 }), 'EXPIRED', 'Peer past deadline = expired');

section('Verification — suggested level');

eq(suggestVerification('REACH_TARGET', true), 'RECEIPT_POS_API', 'WP REACH_TARGET → API');
eq(suggestVerification('JUDGED_BEST', true), 'ORGANIZER_APPROVAL', 'WP JUDGED → organizer');
eq(suggestVerification('COMPLETE_ALL', false), 'PHOTO_UPLOAD', 'Non-WP default photo');

// ═══════════════════════════════════════════════════════════════════════════
// Moderation
// ═══════════════════════════════════════════════════════════════════════════

section('Moderation — keyword block (alcohol)');

{
  const v = evaluateModeration({
    title: 'Who can drink 20 shots fastest',
    intent: 'FRIENDS',
    category: 'SOCIAL',
    visibility: 'PRIVATE',
    reward: 'BADGE',
    verification: 'PHOTO_UPLOAD',
  });
  eq(v.blocked, true, '20 shots blocked');
  eq(v.riskLevel, 'PROHIBITED', '20 shots = PROHIBITED');
  truthy(v.suggestedAlternative?.template === 'RESPONSIBLE_NIGHT_OUT', 'Safer rewrite suggested');
}

{
  const v = evaluateModeration({
    title: 'Responsible night out — drink water between drinks',
    intent: 'FRIENDS',
    category: 'SOCIAL',
    visibility: 'PRIVATE',
    reward: 'BADGE',
    verification: 'PHOTO_UPLOAD',
  });
  falsy(v.blocked, 'Responsible night out passes');
}

section('Moderation — other prohibited');

{
  const v = evaluateModeration({
    title: 'Steal something cool challenge',
    intent: 'FRIENDS',
    category: 'SOCIAL',
    visibility: 'PRIVATE',
    reward: 'BADGE',
    verification: 'PHOTO_UPLOAD',
  });
  eq(v.blocked, true, 'Theft blocked');
}

section('Moderation — risk levels');

{
  const v = evaluateModeration({
    title: 'Family step streak',
    intent: 'FRIENDS',
    category: 'FITNESS',
    visibility: 'PRIVATE',
    reward: 'BADGE',
    verification: 'PHOTO_UPLOAD',
  });
  eq(v.moderationStatus, 'AUTO_APPROVED', 'Private friends fitness badge = auto');
  eq(v.riskLevel, 'MEDIUM', 'Fitness base risk');
}

{
  const v = evaluateModeration({
    title: 'Custom whatever challenge',
    intent: 'PUBLIC',
    category: 'CUSTOM',
    visibility: 'PUBLIC',
    reward: 'VOUCHER',
    verification: 'PARTNER_VERIFIED',
  });
  eq(v.moderationStatus, 'PENDING_REVIEW', 'Public custom voucher = review');
}

section('Moderation — Winner Pool rules');

{
  const v = evaluateModeration({
    title: 'Family step streak',
    intent: 'FRIENDS',
    category: 'FITNESS',
    visibility: 'PRIVATE',
    reward: 'WINNER_POOL',
    verification: 'SELF_DECLARATION',
  });
  eq(v.blocked, true, 'WP + self-declare blocked');
}

{
  const v = evaluateModeration({
    title: 'Family step streak',
    intent: 'FRIENDS',
    category: 'FITNESS',
    visibility: 'PRIVATE',
    reward: 'WINNER_POOL',
    verification: 'PEER_VERIFICATION',
  });
  eq(v.moderationStatus, 'PENDING_REVIEW', 'All WP challenges = pending review (MVP)');
}

{
  const v = evaluateModeration({
    title: 'Public step streak',
    intent: 'PUBLIC',
    category: 'FITNESS',
    visibility: 'PUBLIC',
    reward: 'WINNER_POOL',
    verification: 'RECEIPT_POS_API',
  });
  eq(v.blocked, true, 'Public WP blocked in MVP');
}

// ═══════════════════════════════════════════════════════════════════════════
// Trust score
// ═══════════════════════════════════════════════════════════════════════════

section('Trust score');

{
  const t = computeTrust({
    fraudFlags: 0,
    rejectedSubmissions: 0,
    disputeLosses: 0,
    suspiciousDeviceLinks: 0,
    completedChallenges: 10,
    verifiedApiSubmissions: 10,
    accountAgeMonths: 6,
  });
  eq(t.score, 100, 'Clean user clamps at 100');
  eq(t.tier, 'TRUSTED', 'Clean user trusted');
}

{
  const t = computeTrust({
    fraudFlags: 2,
    rejectedSubmissions: 5,
    disputeLosses: 1,
    suspiciousDeviceLinks: 0,
    completedChallenges: 0,
    verifiedApiSubmissions: 0,
    accountAgeMonths: 0,
  });
  // 100 - (16 + 10 + 6) = 68
  eq(t.score, 68, 'Penalised user score');
  eq(t.tier, 'NORMAL', 'Penalised user normal tier');
}

{
  const t = computeTrust({
    fraudFlags: 10,
    rejectedSubmissions: 0,
    disputeLosses: 0,
    suspiciousDeviceLinks: 5,
    completedChallenges: 0,
    verifiedApiSubmissions: 0,
    accountAgeMonths: 0,
  });
  truthy(t.score < 20, 'Heavy fraud → suspicious tier');
}

eq(tierFromScore(95), 'TRUSTED', 'Tier 95');
eq(tierFromScore(70), 'NORMAL', 'Tier 70');
eq(tierFromScore(45), 'WATCHLIST', 'Tier 45');
eq(tierFromScore(25), 'HIGH_RISK', 'Tier 25');
eq(tierFromScore(10), 'SUSPICIOUS', 'Tier 10');

eq(policyForTier('TRUSTED').allowWinnerPool, true, 'Trusted can WP');
eq(policyForTier('HIGH_RISK').allowWinnerPool, false, 'High-risk cannot WP');
eq(policyForTier('SUSPICIOUS').allowCreate, false, 'Suspicious cannot create');

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
console.log(`Passed: ${passed}   Failed: ${failed}`);
console.log('═'.repeat(60));
process.exit(failed > 0 ? 1 : 0);
