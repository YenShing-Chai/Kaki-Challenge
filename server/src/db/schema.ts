import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  decimal,
  date,
  index,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums (legacy — kept for backwards compat during Phase 2 rewrite) ──────

export const challengeStatusEnum = pgEnum('ChallengeStatus', [
  'OPEN',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
]);

export const participantStatusEnum = pgEnum('ParticipantStatus', [
  'ACTIVE',
  'QUALIFIED',
  'ELIMINATED',
]);

export const transactionTypeEnum = pgEnum('TransactionType', [
  'COMMITMENT_HOLD',
  'COMMITMENT_CAPTURE',
  'PRIZE_PAYOUT',
  'REFUND',
]);

export const gameFormatEnum = pgEnum('GameFormat', [
  'DAILY_STREAK',
  'WEEKLY_QUOTA',
  'COMPLETION_COUNT',
]);

export const dayTypeEnum = pgEnum('DayType', ['POWER', 'ACTIVE', 'FREE', 'MISSED']);

export const verificationMethodEnum = pgEnum('VerificationMethod', [
  'AUTO_STEPS',
  'PHOTO_PROOF',
  'HONOR_TAP',
]);

export const creatorStatusEnum = pgEnum('CreatorStatus', [
  'NONE',
  'APPLIED',
  'APPROVED',
  'REJECTED',
]);

export const challengeCategoryEnum = pgEnum('ChallengeCategory', [
  'FITNESS',
  'MINDFULNESS',
  'READING',
  'LEARNING',
  'PRODUCTIVITY',
  'CREATIVE',
  'WELLNESS',
  'MONEY',
  'SOCIAL',
  'OUTDOORS',
]);

// ─── New enums (PRD-aligned — Phase 2 backend will use these) ──────────────

/** PRD §3 — 7 creator modes */
export const creatorIntentEnum = pgEnum('CreatorIntent', [
  'PERSONAL',
  'FRIENDS',
  'WORKPLACE',
  'MERCHANT',
  'EVENT',
  'COMMUNITY',
  'PUBLIC',
]);

/** PRD §5 — 13 categories (separate enum to avoid conflict with legacy ChallengeCategory) */
export const challengeCategoryV2Enum = pgEnum('ChallengeCategoryV2', [
  'HABIT',
  'FITNESS',
  'MONEY',
  'LEARNING',
  'WORK',
  'SOCIAL',
  'TRAVEL',
  'FOOD',
  'RETAIL',
  'CREATIVE',
  'COMMUNITY',
  'EVENT',
  'CUSTOM',
]);

/** PRD §9.1 */
export const riskLevelEnum = pgEnum('RiskLevel', ['LOW', 'MEDIUM', 'HIGH', 'PROHIBITED']);

/** PRD §9 — moderation outcomes */
export const moderationStatusEnum = pgEnum('ModerationStatus', [
  'AUTO_APPROVED',
  'PENDING_REVIEW',
  'APPROVED',
  'BLOCKED',
  'REJECTED',
]);

/** PRD §6.2 — 11 win-condition codes */
export const winConditionEnum = pgEnum('WinCondition', [
  'COMPLETE_ALL',
  'COMPLETE_MINIMUM',
  'REACH_TARGET',
  'STAY_BELOW_LIMIT',
  'RANK_TOP_N',
  'RANK_TOP_PERCENT',
  'TEAM_TARGET',
  'LAST_REMAINING',
  'FASTEST_COMPLETION',
  'JUDGED_BEST',
  'NO_VIOLATION',
]);

/** PRD §7 — 7-level verification ladder (separate enum from legacy VerificationMethod) */
export const verificationLevelEnum = pgEnum('VerificationLevel', [
  'SELF_DECLARATION',
  'PHOTO_UPLOAD',
  'PEER_VERIFICATION',
  'ORGANIZER_APPROVAL',
  'QR_LOCATION',
  'RECEIPT_POS_API',
  'PARTNER_VERIFIED',
]);

/** PRD §11 — 13 lifecycle statuses (separate enum from legacy ChallengeStatus) */
export const challengeLifecycleEnum = pgEnum('ChallengeLifecycle', [
  'DRAFT',
  'PENDING_REVIEW',
  'SCHEDULED',
  'ACTIVE',
  'PAUSED',
  'ENDED',
  'CALCULATING',
  'DISPUTE_OPEN',
  'LOCKED',
  'REWARD_PROCESSING',
  'COMPLETED',
  'CANCELLED',
  'SUSPENDED',
]);

/** PRD §8 + Winner Pool PRD §8.1 — 9 reward types */
export const rewardTypeEnum = pgEnum('RewardType', [
  'NONE',
  'BADGE',
  'POINTS',
  'VOUCHER',
  'DISCOUNT_FREE_ITEM',
  'SPONSOR_REWARD',
  'REFUNDABLE_DEPOSIT',
  'WINNER_POOL',
  'RANDOM_PAID_PRIZE',
]);

/** PRD §3 — visibility */
export const visibilityEnum = pgEnum('Visibility', ['PRIVATE', 'GROUP', 'PUBLIC']);

/** PRD §16.2 — result statuses */
export const resultStatusEnum = pgEnum('ResultStatus', [
  'PENDING',
  'SUCCESS',
  'FAILED',
  'DISQUALIFIED',
  'PENDING_REVIEW',
  'DISPUTED',
]);

/** PRD §12.1 — submission lifecycle */
export const submissionStatusEnum = pgEnum('SubmissionStatus', [
  'NOT_SUBMITTED',
  'SUBMITTED',
  'AUTO_APPROVED',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'DISPUTED',
  'EXPIRED',
]);

/** PRD §12.3 — dispute reasons */
export const disputeReasonEnum = pgEnum('DisputeReason', [
  'FAKE_PROOF',
  'WRONG_SCORE',
  'LATE_SUBMISSION',
  'RULE_VIOLATION',
  'DUPLICATE_PROOF',
  'UNSAFE_BEHAVIOR',
  'OTHER',
]);

/** Dispute resolution lifecycle */
export const disputeStatusEnum = pgEnum('DisputeStatus', [
  'OPEN',
  'UNDER_REVIEW',
  'UPHELD',
  'REJECTED',
  'WITHDRAWN',
  'RESOLVED_VOID',
]);

/** Winner Pool PRD §7 — 6 distribution methods */
export const distributionMethodEnum = pgEnum('DistributionMethod', [
  'ALL_COMPLETERS_EQUAL_SPLIT',
  'TOP_N_EQUAL_SPLIT',
  'RANKED_PERCENTAGE',
  'PROPORTIONAL',
  'WINNER_TAKES_ALL',
  'TEAM_SPLIT',
]);

/** Winner Pool PRD §14.2 — contribution payment lifecycle */
export const contributionStatusEnum = pgEnum('ContributionStatus', [
  'PENDING',
  'PAID',
  'FAILED',
  'HELD',
  'REFUNDED',
  'FORFEITED',
  'PAYOUT_PENDING',
  'PAID_OUT',
  'CANCELLED',
]);

/** Winner Pool PRD §19.3 — payout lifecycle */
export const payoutStatusEnum = pgEnum('PayoutStatus', [
  'NOT_READY',
  'ON_HOLD',
  'READY',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

/** No-winner fallback (Winner Pool PRD §12.1) */
export const noWinnerRuleEnum = pgEnum('NoWinnerRule', [
  'REFUND_ALL',
  'ROLL_TO_CHARITY',
  'ROLL_TO_PLATFORM',
  'ADMIN_DECISION',
]);

// ─── User ──────────────────────────────────────────────────────────────────

export const users = pgTable(
  'User',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Legacy Clerk identifier — kept nullable so existing rows survive the
    // migration. New signups (post-Clerk) leave this null.
    clerkId: text('clerkId'),
    email: text('email').notNull(),
    passwordHash: text('passwordHash'),
    emailVerifiedAt: timestamp('emailVerifiedAt', { precision: 3, mode: 'date' }),
    name: text('name'),
    avatarUrl: text('avatarUrl'),
    stripeCustomerId: text('stripeCustomerId'),
    stripePaymentMethodId: text('stripePaymentMethodId'),
    timezone: text('timezone').notNull().default('Asia/Kuala_Lumpur'),
    expoPushToken: text('expoPushToken'),
    hasCompletedOnboarding: boolean('hasCompletedOnboarding').notNull().default(false),
    lastJoinNotifyAt: timestamp('lastJoinNotifyAt', { precision: 3, mode: 'date' }),
    currentStreak: integer('currentStreak').notNull().default(0),
    longestStreak: integer('longestStreak').notNull().default(0),
    totalWon: decimal('totalWon', { precision: 10, scale: 2 }).notNull().default('0'),
    totalLost: decimal('totalLost', { precision: 10, scale: 2 }).notNull().default('0'),
    creatorStatus: creatorStatusEnum('creatorStatus').notNull().default('NONE'),
    creatorAppliedAt: timestamp('creatorAppliedAt', { precision: 3, mode: 'date' }),
    creatorBio: text('creatorBio'),
    // ─── New (PRD §10.2 + Winner Pool §21) ──────────────────────────────
    trustScore: integer('trustScore').notNull().default(100),
    fraudFlags: integer('fraudFlags').notNull().default(0),
    kakiPoints: integer('kakiPoints').notNull().default(0),
    isAgeVerified: boolean('isAgeVerified').notNull().default(false),
    jurisdiction: text('jurisdiction'), // ISO country code
    isSuspended: boolean('isSuspended').notNull().default(false),
    suspendedReason: text('suspendedReason'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    clerkIdUnique: uniqueIndex('User_clerkId_key').on(t.clerkId),
    emailUnique: uniqueIndex('User_email_key').on(t.email),
    trustScoreIdx: index('User_trustScore_idx').on(t.trustScore),
  }),
);

// ─── Challenge (expanded with PRD §14.1 fields) ────────────────────────────

export const challenges = pgTable(
  'Challenge',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description'),
    createdById: uuid('createdById')
      .notNull()
      .references(() => users.id),
    isPublic: boolean('isPublic').notNull().default(true),
    commitmentFee: decimal('commitmentFee', { precision: 10, scale: 2 }).notNull(),
    dailyStepGoal: integer('dailyStepGoal').notNull().default(10000),
    durationDays: integer('durationDays').notNull(),
    startDate: date('startDate', { mode: 'date' }).notNull(),
    endDate: date('endDate', { mode: 'date' }).notNull(),
    status: challengeStatusEnum('status').notNull().default('OPEN'),
    prizePool: decimal('prizePool', { precision: 10, scale: 2 }).notNull().default('0'),
    maxParticipants: integer('maxParticipants'),
    minParticipants: integer('minParticipants').notNull().default(2),
    heroImageUrl: text('heroImageUrl'),
    category: challengeCategoryEnum('category'),
    verificationMethod: verificationMethodEnum('verificationMethod')
      .notNull()
      .default('AUTO_STEPS'),
    targetDaysComplete: integer('targetDaysComplete'),
    gameFormat: gameFormatEnum('gameFormat').notNull().default('DAILY_STREAK'),
    activeStepGoal: integer('activeStepGoal'),
    powerStepGoal: integer('powerStepGoal'),
    weeklyActiveDays: integer('weeklyActiveDays').default(4),
    weeklyPowerDays: integer('weeklyPowerDays').default(2),
    weeklyFreeDays: integer('weeklyFreeDays').default(1),
    // ─── New (PRD §14.1) ───────────────────────────────────────────────
    creatorIntent: creatorIntentEnum('creatorIntent'),
    categoryV2: challengeCategoryV2Enum('categoryV2'),
    visibility: visibilityEnum('visibility'),
    lifecycle: challengeLifecycleEnum('lifecycle'),
    riskLevel: riskLevelEnum('riskLevel'),
    moderationStatus: moderationStatusEnum('moderationStatus'),
    moderationReason: text('moderationReason'),
    moderationReviewedBy: uuid('moderationReviewedBy'),
    moderationReviewedAt: timestamp('moderationReviewedAt', { precision: 3, mode: 'date' }),
    rewardType: rewardTypeEnum('rewardType'),
    timezone: text('timezone'), // creator's TZ at create time
    startAt: timestamp('startAt', { precision: 3, mode: 'date' }), // PRD wants timestamp not date
    endAt: timestamp('endAt', { precision: 3, mode: 'date' }),
    disputeWindowHours: integer('disputeWindowHours').notNull().default(24),
    gracePeriodMinutes: integer('gracePeriodMinutes').notNull().default(0),
    allowLateJoin: boolean('allowLateJoin').notNull().default(false),
    publishedAt: timestamp('publishedAt', { precision: 3, mode: 'date' }),
    cancelledAt: timestamp('cancelledAt', { precision: 3, mode: 'date' }),
    cancelledReason: text('cancelledReason'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    creatorIdx: index('Challenge_createdById_idx').on(t.createdById),
    lifecycleIdx: index('Challenge_lifecycle_idx').on(t.lifecycle),
    moderationIdx: index('Challenge_moderationStatus_idx').on(t.moderationStatus),
    startAtIdx: index('Challenge_startAt_idx').on(t.startAt),
  }),
);

// ─── ChallengeRules (PRD §14.2 — 1:1 with challenges) ──────────────────────

export const challengeRules = pgTable(
  'ChallengeRule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeId: uuid('challengeId')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    winConditionType: winConditionEnum('winConditionType').notNull(),
    metricType: text('metricType'), // e.g. STEPS, SAVINGS_AMOUNT, READING_MINUTES
    targetValue: decimal('targetValue', { precision: 12, scale: 2 }),
    limitValue: decimal('limitValue', { precision: 12, scale: 2 }),
    frequency: text('frequency'), // DAILY, WEEKLY, ONCE, CUSTOM
    requiredCount: integer('requiredCount'),
    allowedMisses: integer('allowedMisses').notNull().default(0),
    rankingOrder: text('rankingOrder'), // ASC | DESC
    winnerCount: integer('winnerCount'),
    winnerPercentage: decimal('winnerPercentage', { precision: 5, scale: 2 }),
    tieBreaker: text('tieBreaker'),
    teamTargetValue: decimal('teamTargetValue', { precision: 12, scale: 2 }),
    individualMinimumValue: decimal('individualMinimumValue', { precision: 12, scale: 2 }),
    verificationLevel: verificationLevelEnum('verificationLevel'),
    minConfidenceScore: integer('minConfidenceScore').notNull().default(0),
    ruleConfig: jsonb('ruleConfig'), // free-form for template-specific config
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    challengeUnique: uniqueIndex('ChallengeRule_challengeId_key').on(t.challengeId),
  }),
);

// ─── ChallengeParticipant (expanded with PRD §14.3) ────────────────────────

export const challengeParticipants = pgTable(
  'ChallengeParticipant',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeId: uuid('challengeId')
      .notNull()
      .references(() => challenges.id),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    status: participantStatusEnum('status').notNull().default('ACTIVE'),
    commitmentPaid: decimal('commitmentPaid', { precision: 10, scale: 2 }).notNull(),
    joinedAt: timestamp('joinedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    stripePaymentIntentId: text('stripePaymentIntentId'),
    paymentFailed: boolean('paymentFailed').notNull().default(false),
    // ─── New (PRD §14.3) ───────────────────────────────────────────────
    progressValue: decimal('progressValue', { precision: 12, scale: 2 }).notNull().default('0'),
    completionCount: integer('completionCount').notNull().default(0),
    missedCount: integer('missedCount').notNull().default(0),
    finalScore: decimal('finalScore', { precision: 12, scale: 2 }),
    finalRank: integer('finalRank'),
    resultStatus: resultStatusEnum('resultStatus'),
    rewardStatus: text('rewardStatus'), // PENDING, RELEASED, FORFEITED — fine-grained handled in payouts
    trustScoreSnapshot: integer('trustScoreSnapshot'),
    disqualifiedReason: text('disqualifiedReason'),
    teamId: uuid('teamId'),
  },
  (t) => ({
    challengeUserUnique: uniqueIndex('ChallengeParticipant_challengeId_userId_key').on(
      t.challengeId,
      t.userId,
    ),
    resultStatusIdx: index('ChallengeParticipant_resultStatus_idx').on(t.resultStatus),
  }),
);

// ─── ChallengeSubmission (PRD §14.4) ────────────────────────────────────────

export const challengeSubmissions = pgTable(
  'ChallengeSubmission',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeId: uuid('challengeId')
      .notNull()
      .references(() => challenges.id),
    participantId: uuid('participantId')
      .notNull()
      .references(() => challengeParticipants.id, { onDelete: 'cascade' }),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    submissionType: text('submissionType').notNull(), // PHOTO, STEPS, MANUAL, RECEIPT, QR_SCAN
    evidenceUrl: text('evidenceUrl'),
    metricValue: decimal('metricValue', { precision: 12, scale: 2 }),
    submittedAt: timestamp('submittedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    verificationStatus: submissionStatusEnum('verificationStatus').notNull().default('SUBMITTED'),
    confidenceScore: integer('confidenceScore').notNull().default(0),
    reviewStatus: text('reviewStatus'),
    reviewedBy: uuid('reviewedBy'),
    reviewedAt: timestamp('reviewedAt', { precision: 3, mode: 'date' }),
    rejectionReason: text('rejectionReason'),
    forDate: date('forDate', { mode: 'date' }), // which day this submission counts for
    metadata: jsonb('metadata'),
  },
  (t) => ({
    challengeIdx: index('ChallengeSubmission_challengeId_idx').on(t.challengeId),
    participantIdx: index('ChallengeSubmission_participantId_idx').on(t.participantId),
    submittedAtIdx: index('ChallengeSubmission_submittedAt_idx').on(t.submittedAt),
    statusIdx: index('ChallengeSubmission_verificationStatus_idx').on(t.verificationStatus),
  }),
);

// ─── ChallengePeerReview (supports PRD §7.2 peer verification) ─────────────

export const challengePeerReviews = pgTable(
  'ChallengePeerReview',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submissionId')
      .notNull()
      .references(() => challengeSubmissions.id, { onDelete: 'cascade' }),
    reviewerUserId: uuid('reviewerUserId')
      .notNull()
      .references(() => users.id),
    decision: text('decision').notNull(), // APPROVE | REJECT
    note: text('note'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    submissionReviewerUnique: uniqueIndex('ChallengePeerReview_sub_reviewer_key').on(
      t.submissionId,
      t.reviewerUserId,
    ),
  }),
);

// ─── ChallengeDispute (PRD §14.5) ──────────────────────────────────────────

export const challengeDisputes = pgTable(
  'ChallengeDispute',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeId: uuid('challengeId')
      .notNull()
      .references(() => challenges.id),
    submissionId: uuid('submissionId').references(() => challengeSubmissions.id),
    participantId: uuid('participantId').references(() => challengeParticipants.id),
    raisedBy: uuid('raisedBy')
      .notNull()
      .references(() => users.id),
    disputeReason: disputeReasonEnum('disputeReason').notNull(),
    description: text('description'),
    status: disputeStatusEnum('status').notNull().default('OPEN'),
    resolution: text('resolution'),
    resolvedBy: uuid('resolvedBy'),
    resolvedAt: timestamp('resolvedAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    challengeIdx: index('ChallengeDispute_challengeId_idx').on(t.challengeId),
    statusIdx: index('ChallengeDispute_status_idx').on(t.status),
  }),
);

// ─── ChallengeAuditLog (PRD §14.5) ─────────────────────────────────────────

export const challengeAuditLogs = pgTable(
  'ChallengeAuditLog',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeId: uuid('challengeId')
      .notNull()
      .references(() => challenges.id),
    actorId: uuid('actorId'),
    actorType: text('actorType'), // USER, ADMIN, SYSTEM
    action: text('action').notNull(), // e.g. CHALLENGE_CREATED, STATUS_CHANGED, PAYOUT_APPROVED
    oldValue: jsonb('oldValue'),
    newValue: jsonb('newValue'),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    challengeIdx: index('ChallengeAuditLog_challengeId_idx').on(t.challengeId),
    createdAtIdx: index('ChallengeAuditLog_createdAt_idx').on(t.createdAt),
  }),
);

// ─── ChallengeWinnerPool (Winner Pool PRD §23.1) ────────────────────────────

export const challengeWinnerPools = pgTable(
  'ChallengeWinnerPool',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeId: uuid('challengeId')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    currency: text('currency').notNull().default('MYR'),
    entryContributionAmount: decimal('entryContributionAmount', {
      precision: 12,
      scale: 2,
    }).notNull(),
    totalPoolAmount: decimal('totalPoolAmount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    adjustedPoolAmount: decimal('adjustedPoolAmount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    platformFeeAmount: decimal('platformFeeAmount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    platformFeePercentage: decimal('platformFeePercentage', { precision: 5, scale: 2 }).default('0'),
    platformFeeFixed: decimal('platformFeeFixed', { precision: 12, scale: 2 }).default('0'),
    netPoolAmount: decimal('netPoolAmount', { precision: 12, scale: 2 }).notNull().default('0'),
    distributionMethod: distributionMethodEnum('distributionMethod').notNull(),
    payoutConfig: jsonb('payoutConfig'), // e.g. { rankPercentages: [50, 30, 20] }
    participantMinimum: integer('participantMinimum').notNull(),
    participantMaximum: integer('participantMaximum').notNull(),
    payoutStatus: payoutStatusEnum('payoutStatus').notNull().default('NOT_READY'),
    disputeWindowHours: integer('disputeWindowHours').notNull().default(24),
    autoPayoutAllowed: boolean('autoPayoutAllowed').notNull().default(false),
    manualApprovalRequired: boolean('manualApprovalRequired').notNull().default(true),
    payoutHoldDays: integer('payoutHoldDays').notNull().default(0),
    maxPayoutPerUser: decimal('maxPayoutPerUser', { precision: 12, scale: 2 }),
    minimumScoreToQualify: decimal('minimumScoreToQualify', { precision: 12, scale: 2 }),
    noWinnerRule: noWinnerRuleEnum('noWinnerRule').notNull().default('REFUND_ALL'),
    termsAcceptedAt: timestamp('termsAcceptedAt', { precision: 3, mode: 'date' }),
    calculatedAt: timestamp('calculatedAt', { precision: 3, mode: 'date' }),
    lockedAt: timestamp('lockedAt', { precision: 3, mode: 'date' }),
    payoutsReleasedAt: timestamp('payoutsReleasedAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    challengeUnique: uniqueIndex('ChallengeWinnerPool_challengeId_key').on(t.challengeId),
    payoutStatusIdx: index('ChallengeWinnerPool_payoutStatus_idx').on(t.payoutStatus),
  }),
);

// ─── ChallengePoolContribution (Winner Pool PRD §23.2) ─────────────────────

export const challengePoolContributions = pgTable(
  'ChallengePoolContribution',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    winnerPoolId: uuid('winnerPoolId')
      .notNull()
      .references(() => challengeWinnerPools.id, { onDelete: 'cascade' }),
    challengeId: uuid('challengeId')
      .notNull()
      .references(() => challenges.id),
    participantId: uuid('participantId')
      .notNull()
      .references(() => challengeParticipants.id),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('MYR'),
    paymentReference: text('paymentReference'), // Stripe payment_intent_id
    paymentStatus: contributionStatusEnum('paymentStatus').notNull().default('PENDING'),
    heldAt: timestamp('heldAt', { precision: 3, mode: 'date' }),
    refundedAt: timestamp('refundedAt', { precision: 3, mode: 'date' }),
    forfeitedAt: timestamp('forfeitedAt', { precision: 3, mode: 'date' }),
    chargebackStatus: text('chargebackStatus'),
    failureReason: text('failureReason'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    poolParticipantUnique: uniqueIndex('ChallengePoolContribution_pool_participant_key').on(
      t.winnerPoolId,
      t.participantId,
    ),
    paymentRefIdx: index('ChallengePoolContribution_paymentReference_idx').on(t.paymentReference),
    statusIdx: index('ChallengePoolContribution_paymentStatus_idx').on(t.paymentStatus),
  }),
);

// ─── ChallengePoolPayout (Winner Pool PRD §23.3) ───────────────────────────

export const challengePoolPayouts = pgTable(
  'ChallengePoolPayout',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    winnerPoolId: uuid('winnerPoolId')
      .notNull()
      .references(() => challengeWinnerPools.id, { onDelete: 'cascade' }),
    challengeId: uuid('challengeId')
      .notNull()
      .references(() => challenges.id),
    participantId: uuid('participantId')
      .notNull()
      .references(() => challengeParticipants.id),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    payoutAmount: decimal('payoutAmount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('MYR'),
    payoutFormula: text('payoutFormula'), // human-readable describing calc
    payoutStatus: payoutStatusEnum('payoutStatus').notNull().default('NOT_READY'),
    payoutReference: text('payoutReference'), // Stripe transfer/refund id
    approvedBy: uuid('approvedBy'),
    approvedAt: timestamp('approvedAt', { precision: 3, mode: 'date' }),
    paidAt: timestamp('paidAt', { precision: 3, mode: 'date' }),
    failureReason: text('failureReason'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    poolUserIdx: index('ChallengePoolPayout_pool_user_idx').on(t.winnerPoolId, t.userId),
    statusIdx: index('ChallengePoolPayout_payoutStatus_idx').on(t.payoutStatus),
  }),
);

// ─── DailyProgress (legacy — kept for backwards compat) ────────────────────

export const dailyProgress = pgTable(
  'DailyProgress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    participantId: uuid('participantId')
      .notNull()
      .references(() => challengeParticipants.id),
    date: date('date', { mode: 'date' }).notNull(),
    stepsAchieved: integer('stepsAchieved').notNull().default(0),
    goalSteps: integer('goalSteps').notNull(),
    completed: boolean('completed').notNull().default(false),
    dayType: dayTypeEnum('dayType'),
    proofPhotoUrl: text('proofPhotoUrl'),
    proofSubmittedAt: timestamp('proofSubmittedAt', { precision: 3, mode: 'date' }),
    syncedAt: timestamp('syncedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    participantDateUnique: uniqueIndex('DailyProgress_participantId_date_key').on(
      t.participantId,
      t.date,
    ),
  }),
);

// ─── StepLog ───────────────────────────────────────────────────────────────

export const stepLogs = pgTable(
  'StepLog',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    date: date('date', { mode: 'date' }).notNull(),
    stepsCount: integer('stepsCount').notNull(),
    manualEntry: boolean('manualEntry').notNull().default(false),
    syncedAt: timestamp('syncedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    userDateUnique: uniqueIndex('StepLog_userId_date_key').on(t.userId, t.date),
  }),
);

// ─── Cheer ─────────────────────────────────────────────────────────────────

export const cheers = pgTable(
  'Cheer',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromUserId: uuid('fromUserId')
      .notNull()
      .references(() => users.id),
    toUserId: uuid('toUserId')
      .notNull()
      .references(() => users.id),
    dailyProgressId: uuid('dailyProgressId')
      .notNull()
      .references(() => dailyProgress.id),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    fromProgressUnique: uniqueIndex('Cheer_fromUserId_dailyProgressId_key').on(
      t.fromUserId,
      t.dailyProgressId,
    ),
    toUserIdx: index('Cheer_toUserId_idx').on(t.toUserId),
    dailyProgressIdx: index('Cheer_dailyProgressId_idx').on(t.dailyProgressId),
  }),
);

// ─── Transaction (legacy — Phase 2 replaces with pool contributions/payouts)

export const transactions = pgTable('Transaction', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => users.id),
  type: transactionTypeEnum('type').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description'),
  stripePaymentIntentId: text('stripePaymentIntentId'),
  createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
});

// ─── Relations ─────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  participations: many(challengeParticipants),
  stepLogs: many(stepLogs),
  transactions: many(transactions),
  createdChallenges: many(challenges),
  submissions: many(challengeSubmissions),
  disputesRaised: many(challengeDisputes),
  poolContributions: many(challengePoolContributions),
  poolPayouts: many(challengePoolPayouts),
}));

export const challengesRelations = relations(challenges, ({ one, many }) => ({
  createdBy: one(users, { fields: [challenges.createdById], references: [users.id] }),
  participants: many(challengeParticipants),
  rule: one(challengeRules, {
    fields: [challenges.id],
    references: [challengeRules.challengeId],
  }),
  winnerPool: one(challengeWinnerPools, {
    fields: [challenges.id],
    references: [challengeWinnerPools.challengeId],
  }),
  submissions: many(challengeSubmissions),
  disputes: many(challengeDisputes),
  auditLogs: many(challengeAuditLogs),
}));

export const challengeRulesRelations = relations(challengeRules, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challengeRules.challengeId],
    references: [challenges.id],
  }),
}));

export const challengeParticipantsRelations = relations(challengeParticipants, ({ one, many }) => ({
  challenge: one(challenges, {
    fields: [challengeParticipants.challengeId],
    references: [challenges.id],
  }),
  user: one(users, { fields: [challengeParticipants.userId], references: [users.id] }),
  dailyProgress: many(dailyProgress),
  submissions: many(challengeSubmissions),
  contribution: one(challengePoolContributions, {
    fields: [challengeParticipants.id],
    references: [challengePoolContributions.participantId],
  }),
  payout: one(challengePoolPayouts, {
    fields: [challengeParticipants.id],
    references: [challengePoolPayouts.participantId],
  }),
}));

export const challengeSubmissionsRelations = relations(challengeSubmissions, ({ one, many }) => ({
  challenge: one(challenges, {
    fields: [challengeSubmissions.challengeId],
    references: [challenges.id],
  }),
  participant: one(challengeParticipants, {
    fields: [challengeSubmissions.participantId],
    references: [challengeParticipants.id],
  }),
  user: one(users, { fields: [challengeSubmissions.userId], references: [users.id] }),
  peerReviews: many(challengePeerReviews),
}));

export const challengePeerReviewsRelations = relations(challengePeerReviews, ({ one }) => ({
  submission: one(challengeSubmissions, {
    fields: [challengePeerReviews.submissionId],
    references: [challengeSubmissions.id],
  }),
  reviewer: one(users, {
    fields: [challengePeerReviews.reviewerUserId],
    references: [users.id],
  }),
}));

export const challengeDisputesRelations = relations(challengeDisputes, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challengeDisputes.challengeId],
    references: [challenges.id],
  }),
  raiser: one(users, { fields: [challengeDisputes.raisedBy], references: [users.id] }),
}));

export const challengeAuditLogsRelations = relations(challengeAuditLogs, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challengeAuditLogs.challengeId],
    references: [challenges.id],
  }),
}));

export const challengeWinnerPoolsRelations = relations(challengeWinnerPools, ({ one, many }) => ({
  challenge: one(challenges, {
    fields: [challengeWinnerPools.challengeId],
    references: [challenges.id],
  }),
  contributions: many(challengePoolContributions),
  payouts: many(challengePoolPayouts),
}));

export const challengePoolContributionsRelations = relations(
  challengePoolContributions,
  ({ one }) => ({
    pool: one(challengeWinnerPools, {
      fields: [challengePoolContributions.winnerPoolId],
      references: [challengeWinnerPools.id],
    }),
    challenge: one(challenges, {
      fields: [challengePoolContributions.challengeId],
      references: [challenges.id],
    }),
    participant: one(challengeParticipants, {
      fields: [challengePoolContributions.participantId],
      references: [challengeParticipants.id],
    }),
    user: one(users, {
      fields: [challengePoolContributions.userId],
      references: [users.id],
    }),
  }),
);

export const challengePoolPayoutsRelations = relations(challengePoolPayouts, ({ one }) => ({
  pool: one(challengeWinnerPools, {
    fields: [challengePoolPayouts.winnerPoolId],
    references: [challengeWinnerPools.id],
  }),
  challenge: one(challenges, {
    fields: [challengePoolPayouts.challengeId],
    references: [challenges.id],
  }),
  participant: one(challengeParticipants, {
    fields: [challengePoolPayouts.participantId],
    references: [challengeParticipants.id],
  }),
  user: one(users, {
    fields: [challengePoolPayouts.userId],
    references: [users.id],
  }),
}));

export const dailyProgressRelations = relations(dailyProgress, ({ one, many }) => ({
  participant: one(challengeParticipants, {
    fields: [dailyProgress.participantId],
    references: [challengeParticipants.id],
  }),
  cheers: many(cheers),
}));

export const stepLogsRelations = relations(stepLogs, ({ one }) => ({
  user: one(users, { fields: [stepLogs.userId], references: [users.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
}));

export const cheersRelations = relations(cheers, ({ one }) => ({
  fromUser: one(users, { fields: [cheers.fromUserId], references: [users.id], relationName: 'cheersGiven' }),
  toUser: one(users, { fields: [cheers.toUserId], references: [users.id], relationName: 'cheersReceived' }),
  dailyProgress: one(dailyProgress, { fields: [cheers.dailyProgressId], references: [dailyProgress.id] }),
}));

// ─── Inferred types ────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Challenge = typeof challenges.$inferSelect;
export type NewChallenge = typeof challenges.$inferInsert;
export type ChallengeRule = typeof challengeRules.$inferSelect;
export type NewChallengeRule = typeof challengeRules.$inferInsert;
export type ChallengeParticipant = typeof challengeParticipants.$inferSelect;
export type NewChallengeParticipant = typeof challengeParticipants.$inferInsert;
export type ChallengeSubmission = typeof challengeSubmissions.$inferSelect;
export type NewChallengeSubmission = typeof challengeSubmissions.$inferInsert;
export type ChallengePeerReview = typeof challengePeerReviews.$inferSelect;
export type NewChallengePeerReview = typeof challengePeerReviews.$inferInsert;
export type ChallengeDispute = typeof challengeDisputes.$inferSelect;
export type NewChallengeDispute = typeof challengeDisputes.$inferInsert;
export type ChallengeAuditLog = typeof challengeAuditLogs.$inferSelect;
export type NewChallengeAuditLog = typeof challengeAuditLogs.$inferInsert;
export type ChallengeWinnerPool = typeof challengeWinnerPools.$inferSelect;
export type NewChallengeWinnerPool = typeof challengeWinnerPools.$inferInsert;
export type ChallengePoolContribution = typeof challengePoolContributions.$inferSelect;
export type NewChallengePoolContribution = typeof challengePoolContributions.$inferInsert;
export type ChallengePoolPayout = typeof challengePoolPayouts.$inferSelect;
export type NewChallengePoolPayout = typeof challengePoolPayouts.$inferInsert;
export type DailyProgress = typeof dailyProgress.$inferSelect;
export type NewDailyProgress = typeof dailyProgress.$inferInsert;
export type StepLog = typeof stepLogs.$inferSelect;
export type NewStepLog = typeof stepLogs.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Cheer = typeof cheers.$inferSelect;
export type NewCheer = typeof cheers.$inferInsert;
