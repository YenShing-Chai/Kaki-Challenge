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
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ─────────────────────────────────────────────────────────────────

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
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    clerkIdUnique: uniqueIndex('User_clerkId_key').on(t.clerkId),
    emailUnique: uniqueIndex('User_email_key').on(t.email),
  }),
);

// ─── Challenge ─────────────────────────────────────────────────────────────

export const challenges = pgTable('Challenge', {
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
  createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
});

// ─── ChallengeParticipant ──────────────────────────────────────────────────

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
  },
  (t) => ({
    challengeUserUnique: uniqueIndex('ChallengeParticipant_challengeId_userId_key').on(
      t.challengeId,
      t.userId,
    ),
  }),
);

// ─── DailyProgress ─────────────────────────────────────────────────────────

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

// ─── Transaction ───────────────────────────────────────────────────────────

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
}));

export const challengesRelations = relations(challenges, ({ one, many }) => ({
  createdBy: one(users, { fields: [challenges.createdById], references: [users.id] }),
  participants: many(challengeParticipants),
}));

export const challengeParticipantsRelations = relations(challengeParticipants, ({ one, many }) => ({
  challenge: one(challenges, {
    fields: [challengeParticipants.challengeId],
    references: [challenges.id],
  }),
  user: one(users, { fields: [challengeParticipants.userId], references: [users.id] }),
  dailyProgress: many(dailyProgress),
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
export type ChallengeParticipant = typeof challengeParticipants.$inferSelect;
export type NewChallengeParticipant = typeof challengeParticipants.$inferInsert;
export type DailyProgress = typeof dailyProgress.$inferSelect;
export type NewDailyProgress = typeof dailyProgress.$inferInsert;
export type StepLog = typeof stepLogs.$inferSelect;
export type NewStepLog = typeof stepLogs.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Cheer = typeof cheers.$inferSelect;
export type NewCheer = typeof cheers.$inferInsert;
