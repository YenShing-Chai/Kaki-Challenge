CREATE TABLE "Cheer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fromUserId" uuid NOT NULL,
	"toUserId" uuid NOT NULL,
	"dailyProgressId" uuid NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_fromUserId_User_id_fk" FOREIGN KEY ("fromUserId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_toUserId_User_id_fk" FOREIGN KEY ("toUserId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_dailyProgressId_DailyProgress_id_fk" FOREIGN KEY ("dailyProgressId") REFERENCES "public"."DailyProgress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "Cheer_fromUserId_dailyProgressId_key" ON "Cheer" USING btree ("fromUserId","dailyProgressId");--> statement-breakpoint
CREATE INDEX "Cheer_toUserId_idx" ON "Cheer" USING btree ("toUserId");--> statement-breakpoint
CREATE INDEX "Cheer_dailyProgressId_idx" ON "Cheer" USING btree ("dailyProgressId");