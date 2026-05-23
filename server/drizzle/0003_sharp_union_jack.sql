CREATE TYPE "public"."ChallengeCategoryV2" AS ENUM('HABIT', 'FITNESS', 'MONEY', 'LEARNING', 'WORK', 'SOCIAL', 'TRAVEL', 'FOOD', 'RETAIL', 'CREATIVE', 'COMMUNITY', 'EVENT', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."ChallengeLifecycle" AS ENUM('DRAFT', 'PENDING_REVIEW', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ENDED', 'CALCULATING', 'DISPUTE_OPEN', 'LOCKED', 'REWARD_PROCESSING', 'COMPLETED', 'CANCELLED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."ContributionStatus" AS ENUM('PENDING', 'PAID', 'FAILED', 'HELD', 'REFUNDED', 'FORFEITED', 'PAYOUT_PENDING', 'PAID_OUT', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."CreatorIntent" AS ENUM('PERSONAL', 'FRIENDS', 'WORKPLACE', 'MERCHANT', 'EVENT', 'COMMUNITY', 'PUBLIC');--> statement-breakpoint
CREATE TYPE "public"."DisputeReason" AS ENUM('FAKE_PROOF', 'WRONG_SCORE', 'LATE_SUBMISSION', 'RULE_VIOLATION', 'DUPLICATE_PROOF', 'UNSAFE_BEHAVIOR', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."DisputeStatus" AS ENUM('OPEN', 'UNDER_REVIEW', 'UPHELD', 'REJECTED', 'WITHDRAWN', 'RESOLVED_VOID');--> statement-breakpoint
CREATE TYPE "public"."DistributionMethod" AS ENUM('ALL_COMPLETERS_EQUAL_SPLIT', 'TOP_N_EQUAL_SPLIT', 'RANKED_PERCENTAGE', 'PROPORTIONAL', 'WINNER_TAKES_ALL', 'TEAM_SPLIT');--> statement-breakpoint
CREATE TYPE "public"."ModerationStatus" AS ENUM('AUTO_APPROVED', 'PENDING_REVIEW', 'APPROVED', 'BLOCKED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."NoWinnerRule" AS ENUM('REFUND_ALL', 'ROLL_TO_CHARITY', 'ROLL_TO_PLATFORM', 'ADMIN_DECISION');--> statement-breakpoint
CREATE TYPE "public"."PayoutStatus" AS ENUM('NOT_READY', 'ON_HOLD', 'READY', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."ResultStatus" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'DISQUALIFIED', 'PENDING_REVIEW', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."RewardType" AS ENUM('NONE', 'BADGE', 'POINTS', 'VOUCHER', 'DISCOUNT_FREE_ITEM', 'SPONSOR_REWARD', 'REFUNDABLE_DEPOSIT', 'WINNER_POOL', 'RANDOM_PAID_PRIZE');--> statement-breakpoint
CREATE TYPE "public"."RiskLevel" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'PROHIBITED');--> statement-breakpoint
CREATE TYPE "public"."SubmissionStatus" AS ENUM('NOT_SUBMITTED', 'SUBMITTED', 'AUTO_APPROVED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'DISPUTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."VerificationLevel" AS ENUM('SELF_DECLARATION', 'PHOTO_UPLOAD', 'PEER_VERIFICATION', 'ORGANIZER_APPROVAL', 'QR_LOCATION', 'RECEIPT_POS_API', 'PARTNER_VERIFIED');--> statement-breakpoint
CREATE TYPE "public"."Visibility" AS ENUM('PRIVATE', 'GROUP', 'PUBLIC');--> statement-breakpoint
CREATE TYPE "public"."WinCondition" AS ENUM('COMPLETE_ALL', 'COMPLETE_MINIMUM', 'REACH_TARGET', 'STAY_BELOW_LIMIT', 'RANK_TOP_N', 'RANK_TOP_PERCENT', 'TEAM_TARGET', 'LAST_REMAINING', 'FASTEST_COMPLETION', 'JUDGED_BEST', 'NO_VIOLATION');--> statement-breakpoint
CREATE TABLE "ChallengeAuditLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challengeId" uuid NOT NULL,
	"actorId" uuid,
	"actorType" text,
	"action" text NOT NULL,
	"oldValue" jsonb,
	"newValue" jsonb,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ChallengeDispute" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challengeId" uuid NOT NULL,
	"submissionId" uuid,
	"participantId" uuid,
	"raisedBy" uuid NOT NULL,
	"disputeReason" "DisputeReason" NOT NULL,
	"description" text,
	"status" "DisputeStatus" DEFAULT 'OPEN' NOT NULL,
	"resolution" text,
	"resolvedBy" uuid,
	"resolvedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ChallengePeerReview" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submissionId" uuid NOT NULL,
	"reviewerUserId" uuid NOT NULL,
	"decision" text NOT NULL,
	"note" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ChallengePoolContribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"winnerPoolId" uuid NOT NULL,
	"challengeId" uuid NOT NULL,
	"participantId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'MYR' NOT NULL,
	"paymentReference" text,
	"paymentStatus" "ContributionStatus" DEFAULT 'PENDING' NOT NULL,
	"heldAt" timestamp (3),
	"refundedAt" timestamp (3),
	"forfeitedAt" timestamp (3),
	"chargebackStatus" text,
	"failureReason" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ChallengePoolPayout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"winnerPoolId" uuid NOT NULL,
	"challengeId" uuid NOT NULL,
	"participantId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"payoutAmount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'MYR' NOT NULL,
	"payoutFormula" text,
	"payoutStatus" "PayoutStatus" DEFAULT 'NOT_READY' NOT NULL,
	"payoutReference" text,
	"approvedBy" uuid,
	"approvedAt" timestamp (3),
	"paidAt" timestamp (3),
	"failureReason" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ChallengeRule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challengeId" uuid NOT NULL,
	"winConditionType" "WinCondition" NOT NULL,
	"metricType" text,
	"targetValue" numeric(12, 2),
	"limitValue" numeric(12, 2),
	"frequency" text,
	"requiredCount" integer,
	"allowedMisses" integer DEFAULT 0 NOT NULL,
	"rankingOrder" text,
	"winnerCount" integer,
	"winnerPercentage" numeric(5, 2),
	"tieBreaker" text,
	"teamTargetValue" numeric(12, 2),
	"individualMinimumValue" numeric(12, 2),
	"verificationLevel" "VerificationLevel",
	"minConfidenceScore" integer DEFAULT 0 NOT NULL,
	"ruleConfig" jsonb,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ChallengeSubmission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challengeId" uuid NOT NULL,
	"participantId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"submissionType" text NOT NULL,
	"evidenceUrl" text,
	"metricValue" numeric(12, 2),
	"submittedAt" timestamp (3) DEFAULT now() NOT NULL,
	"verificationStatus" "SubmissionStatus" DEFAULT 'SUBMITTED' NOT NULL,
	"confidenceScore" integer DEFAULT 0 NOT NULL,
	"reviewStatus" text,
	"reviewedBy" uuid,
	"reviewedAt" timestamp (3),
	"rejectionReason" text,
	"forDate" date,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "ChallengeWinnerPool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challengeId" uuid NOT NULL,
	"currency" text DEFAULT 'MYR' NOT NULL,
	"entryContributionAmount" numeric(12, 2) NOT NULL,
	"totalPoolAmount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"adjustedPoolAmount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"platformFeeAmount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"platformFeePercentage" numeric(5, 2) DEFAULT '0',
	"platformFeeFixed" numeric(12, 2) DEFAULT '0',
	"netPoolAmount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"distributionMethod" "DistributionMethod" NOT NULL,
	"payoutConfig" jsonb,
	"participantMinimum" integer NOT NULL,
	"participantMaximum" integer NOT NULL,
	"payoutStatus" "PayoutStatus" DEFAULT 'NOT_READY' NOT NULL,
	"disputeWindowHours" integer DEFAULT 24 NOT NULL,
	"autoPayoutAllowed" boolean DEFAULT false NOT NULL,
	"manualApprovalRequired" boolean DEFAULT true NOT NULL,
	"payoutHoldDays" integer DEFAULT 0 NOT NULL,
	"maxPayoutPerUser" numeric(12, 2),
	"minimumScoreToQualify" numeric(12, 2),
	"noWinnerRule" "NoWinnerRule" DEFAULT 'REFUND_ALL' NOT NULL,
	"termsAcceptedAt" timestamp (3),
	"calculatedAt" timestamp (3),
	"lockedAt" timestamp (3),
	"payoutsReleasedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ChallengeParticipant" ADD COLUMN "progressValue" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "ChallengeParticipant" ADD COLUMN "completionCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ChallengeParticipant" ADD COLUMN "missedCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ChallengeParticipant" ADD COLUMN "finalScore" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "ChallengeParticipant" ADD COLUMN "finalRank" integer;--> statement-breakpoint
ALTER TABLE "ChallengeParticipant" ADD COLUMN "resultStatus" "ResultStatus";--> statement-breakpoint
ALTER TABLE "ChallengeParticipant" ADD COLUMN "rewardStatus" text;--> statement-breakpoint
ALTER TABLE "ChallengeParticipant" ADD COLUMN "trustScoreSnapshot" integer;--> statement-breakpoint
ALTER TABLE "ChallengeParticipant" ADD COLUMN "disqualifiedReason" text;--> statement-breakpoint
ALTER TABLE "ChallengeParticipant" ADD COLUMN "teamId" uuid;--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "creatorIntent" "CreatorIntent";--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "categoryV2" "ChallengeCategoryV2";--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "visibility" "Visibility";--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "lifecycle" "ChallengeLifecycle";--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "riskLevel" "RiskLevel";--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "moderationStatus" "ModerationStatus";--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "moderationReason" text;--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "moderationReviewedBy" uuid;--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "moderationReviewedAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "rewardType" "RewardType";--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "startAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "endAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "disputeWindowHours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "gracePeriodMinutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "allowLateJoin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "publishedAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "cancelledAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "Challenge" ADD COLUMN "cancelledReason" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "trustScore" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "fraudFlags" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "kakiPoints" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "isAgeVerified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "jurisdiction" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "isSuspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "suspendedReason" text;--> statement-breakpoint
ALTER TABLE "ChallengeAuditLog" ADD CONSTRAINT "ChallengeAuditLog_challengeId_Challenge_id_fk" FOREIGN KEY ("challengeId") REFERENCES "public"."Challenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengeDispute" ADD CONSTRAINT "ChallengeDispute_challengeId_Challenge_id_fk" FOREIGN KEY ("challengeId") REFERENCES "public"."Challenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengeDispute" ADD CONSTRAINT "ChallengeDispute_submissionId_ChallengeSubmission_id_fk" FOREIGN KEY ("submissionId") REFERENCES "public"."ChallengeSubmission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengeDispute" ADD CONSTRAINT "ChallengeDispute_participantId_ChallengeParticipant_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."ChallengeParticipant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengeDispute" ADD CONSTRAINT "ChallengeDispute_raisedBy_User_id_fk" FOREIGN KEY ("raisedBy") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengePeerReview" ADD CONSTRAINT "ChallengePeerReview_submissionId_ChallengeSubmission_id_fk" FOREIGN KEY ("submissionId") REFERENCES "public"."ChallengeSubmission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengePeerReview" ADD CONSTRAINT "ChallengePeerReview_reviewerUserId_User_id_fk" FOREIGN KEY ("reviewerUserId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengePoolContribution" ADD CONSTRAINT "ChallengePoolContribution_winnerPoolId_ChallengeWinnerPool_id_fk" FOREIGN KEY ("winnerPoolId") REFERENCES "public"."ChallengeWinnerPool"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengePoolContribution" ADD CONSTRAINT "ChallengePoolContribution_challengeId_Challenge_id_fk" FOREIGN KEY ("challengeId") REFERENCES "public"."Challenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengePoolContribution" ADD CONSTRAINT "ChallengePoolContribution_participantId_ChallengeParticipant_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."ChallengeParticipant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengePoolContribution" ADD CONSTRAINT "ChallengePoolContribution_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengePoolPayout" ADD CONSTRAINT "ChallengePoolPayout_winnerPoolId_ChallengeWinnerPool_id_fk" FOREIGN KEY ("winnerPoolId") REFERENCES "public"."ChallengeWinnerPool"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengePoolPayout" ADD CONSTRAINT "ChallengePoolPayout_challengeId_Challenge_id_fk" FOREIGN KEY ("challengeId") REFERENCES "public"."Challenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengePoolPayout" ADD CONSTRAINT "ChallengePoolPayout_participantId_ChallengeParticipant_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."ChallengeParticipant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengePoolPayout" ADD CONSTRAINT "ChallengePoolPayout_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengeRule" ADD CONSTRAINT "ChallengeRule_challengeId_Challenge_id_fk" FOREIGN KEY ("challengeId") REFERENCES "public"."Challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengeSubmission" ADD CONSTRAINT "ChallengeSubmission_challengeId_Challenge_id_fk" FOREIGN KEY ("challengeId") REFERENCES "public"."Challenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengeSubmission" ADD CONSTRAINT "ChallengeSubmission_participantId_ChallengeParticipant_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."ChallengeParticipant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengeSubmission" ADD CONSTRAINT "ChallengeSubmission_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengeWinnerPool" ADD CONSTRAINT "ChallengeWinnerPool_challengeId_Challenge_id_fk" FOREIGN KEY ("challengeId") REFERENCES "public"."Challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ChallengeAuditLog_challengeId_idx" ON "ChallengeAuditLog" USING btree ("challengeId");--> statement-breakpoint
CREATE INDEX "ChallengeAuditLog_createdAt_idx" ON "ChallengeAuditLog" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "ChallengeDispute_challengeId_idx" ON "ChallengeDispute" USING btree ("challengeId");--> statement-breakpoint
CREATE INDEX "ChallengeDispute_status_idx" ON "ChallengeDispute" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ChallengePeerReview_sub_reviewer_key" ON "ChallengePeerReview" USING btree ("submissionId","reviewerUserId");--> statement-breakpoint
CREATE UNIQUE INDEX "ChallengePoolContribution_pool_participant_key" ON "ChallengePoolContribution" USING btree ("winnerPoolId","participantId");--> statement-breakpoint
CREATE INDEX "ChallengePoolContribution_paymentReference_idx" ON "ChallengePoolContribution" USING btree ("paymentReference");--> statement-breakpoint
CREATE INDEX "ChallengePoolContribution_paymentStatus_idx" ON "ChallengePoolContribution" USING btree ("paymentStatus");--> statement-breakpoint
CREATE INDEX "ChallengePoolPayout_pool_user_idx" ON "ChallengePoolPayout" USING btree ("winnerPoolId","userId");--> statement-breakpoint
CREATE INDEX "ChallengePoolPayout_payoutStatus_idx" ON "ChallengePoolPayout" USING btree ("payoutStatus");--> statement-breakpoint
CREATE UNIQUE INDEX "ChallengeRule_challengeId_key" ON "ChallengeRule" USING btree ("challengeId");--> statement-breakpoint
CREATE INDEX "ChallengeSubmission_challengeId_idx" ON "ChallengeSubmission" USING btree ("challengeId");--> statement-breakpoint
CREATE INDEX "ChallengeSubmission_participantId_idx" ON "ChallengeSubmission" USING btree ("participantId");--> statement-breakpoint
CREATE INDEX "ChallengeSubmission_submittedAt_idx" ON "ChallengeSubmission" USING btree ("submittedAt");--> statement-breakpoint
CREATE INDEX "ChallengeSubmission_verificationStatus_idx" ON "ChallengeSubmission" USING btree ("verificationStatus");--> statement-breakpoint
CREATE UNIQUE INDEX "ChallengeWinnerPool_challengeId_key" ON "ChallengeWinnerPool" USING btree ("challengeId");--> statement-breakpoint
CREATE INDEX "ChallengeWinnerPool_payoutStatus_idx" ON "ChallengeWinnerPool" USING btree ("payoutStatus");--> statement-breakpoint
CREATE INDEX "ChallengeParticipant_resultStatus_idx" ON "ChallengeParticipant" USING btree ("resultStatus");--> statement-breakpoint
CREATE INDEX "Challenge_createdById_idx" ON "Challenge" USING btree ("createdById");--> statement-breakpoint
CREATE INDEX "Challenge_lifecycle_idx" ON "Challenge" USING btree ("lifecycle");--> statement-breakpoint
CREATE INDEX "Challenge_moderationStatus_idx" ON "Challenge" USING btree ("moderationStatus");--> statement-breakpoint
CREATE INDEX "Challenge_startAt_idx" ON "Challenge" USING btree ("startAt");--> statement-breakpoint
CREATE INDEX "User_trustScore_idx" ON "User" USING btree ("trustScore");