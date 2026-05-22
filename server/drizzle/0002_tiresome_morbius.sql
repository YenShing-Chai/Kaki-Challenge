ALTER TABLE "User" ALTER COLUMN "clerkId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "passwordHash" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" timestamp (3);