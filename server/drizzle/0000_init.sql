CREATE TYPE "public"."ChallengeCategory" AS ENUM('FITNESS', 'MINDFULNESS', 'READING', 'LEARNING', 'PRODUCTIVITY', 'CREATIVE', 'WELLNESS', 'MONEY', 'SOCIAL', 'OUTDOORS');--> statement-breakpoint
CREATE TYPE "public"."ChallengeStatus" AS ENUM('OPEN', 'ACTIVE', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."CreatorStatus" AS ENUM('NONE', 'APPLIED', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."DayType" AS ENUM('POWER', 'ACTIVE', 'FREE', 'MISSED');--> statement-breakpoint
CREATE TYPE "public"."GameFormat" AS ENUM('DAILY_STREAK', 'WEEKLY_QUOTA', 'COMPLETION_COUNT');--> statement-breakpoint
CREATE TYPE "public"."ParticipantStatus" AS ENUM('ACTIVE', 'QUALIFIED', 'ELIMINATED');--> statement-breakpoint
CREATE TYPE "public"."TransactionType" AS ENUM('COMMITMENT_HOLD', 'COMMITMENT_CAPTURE', 'PRIZE_PAYOUT', 'REFUND');--> statement-breakpoint
CREATE TYPE "public"."VerificationMethod" AS ENUM('AUTO_STEPS', 'PHOTO_PROOF', 'HONOR_TAP');--> statement-breakpoint
CREATE TABLE "ChallengeParticipant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challengeId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"status" "ParticipantStatus" DEFAULT 'ACTIVE' NOT NULL,
	"commitmentPaid" numeric(10, 2) NOT NULL,
	"joinedAt" timestamp (3) DEFAULT now() NOT NULL,
	"stripePaymentIntentId" text,
	"paymentFailed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Challenge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"createdById" uuid NOT NULL,
	"isPublic" boolean DEFAULT true NOT NULL,
	"commitmentFee" numeric(10, 2) NOT NULL,
	"dailyStepGoal" integer DEFAULT 10000 NOT NULL,
	"durationDays" integer NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date NOT NULL,
	"status" "ChallengeStatus" DEFAULT 'OPEN' NOT NULL,
	"prizePool" numeric(10, 2) DEFAULT '0' NOT NULL,
	"maxParticipants" integer,
	"minParticipants" integer DEFAULT 2 NOT NULL,
	"heroImageUrl" text,
	"category" "ChallengeCategory",
	"verificationMethod" "VerificationMethod" DEFAULT 'AUTO_STEPS' NOT NULL,
	"targetDaysComplete" integer,
	"gameFormat" "GameFormat" DEFAULT 'DAILY_STREAK' NOT NULL,
	"activeStepGoal" integer,
	"powerStepGoal" integer,
	"weeklyActiveDays" integer DEFAULT 4,
	"weeklyPowerDays" integer DEFAULT 2,
	"weeklyFreeDays" integer DEFAULT 1,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DailyProgress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participantId" uuid NOT NULL,
	"date" date NOT NULL,
	"stepsAchieved" integer DEFAULT 0 NOT NULL,
	"goalSteps" integer NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"dayType" "DayType",
	"proofPhotoUrl" text,
	"proofSubmittedAt" timestamp (3),
	"syncedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StepLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"date" date NOT NULL,
	"stepsCount" integer NOT NULL,
	"manualEntry" boolean DEFAULT false NOT NULL,
	"syncedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"type" "TransactionType" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text,
	"stripePaymentIntentId" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerkId" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatarUrl" text,
	"stripeCustomerId" text,
	"stripePaymentMethodId" text,
	"timezone" text DEFAULT 'Asia/Kuala_Lumpur' NOT NULL,
	"expoPushToken" text,
	"hasCompletedOnboarding" boolean DEFAULT false NOT NULL,
	"lastJoinNotifyAt" timestamp (3),
	"currentStreak" integer DEFAULT 0 NOT NULL,
	"longestStreak" integer DEFAULT 0 NOT NULL,
	"totalWon" numeric(10, 2) DEFAULT '0' NOT NULL,
	"totalLost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"creatorStatus" "CreatorStatus" DEFAULT 'NONE' NOT NULL,
	"creatorAppliedAt" timestamp (3),
	"creatorBio" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_challengeId_Challenge_id_fk" FOREIGN KEY ("challengeId") REFERENCES "public"."Challenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_createdById_User_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DailyProgress" ADD CONSTRAINT "DailyProgress_participantId_ChallengeParticipant_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."ChallengeParticipant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StepLog" ADD CONSTRAINT "StepLog_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ChallengeParticipant_challengeId_userId_key" ON "ChallengeParticipant" USING btree ("challengeId","userId");--> statement-breakpoint
CREATE UNIQUE INDEX "DailyProgress_participantId_date_key" ON "DailyProgress" USING btree ("participantId","date");--> statement-breakpoint
CREATE UNIQUE INDEX "StepLog_userId_date_key" ON "StepLog" USING btree ("userId","date");--> statement-breakpoint
CREATE UNIQUE INDEX "User_clerkId_key" ON "User" USING btree ("clerkId");--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email");