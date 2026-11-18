ALTER TABLE "vote_events" ADD COLUMN "detail_title" text;--> statement-breakpoint
ALTER TABLE "vote_events" ADD COLUMN "detail_date" text;--> statement-breakpoint
ALTER TABLE "vote_events" ADD COLUMN "detail_source_url" text;--> statement-breakpoint
ALTER TABLE "vote_events" ADD COLUMN "detail_source_hash" text;--> statement-breakpoint
ALTER TABLE "vote_events" ADD COLUMN "detail_fetched_at" timestamp with time zone;