ALTER TABLE "User" ADD COLUMN "stripeConnectAccountId" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "connectChargesEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "connectPayoutsEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "connectStatus" text DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "connectRequirementsDue" jsonb;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "connectOnboardedAt" timestamp (3);