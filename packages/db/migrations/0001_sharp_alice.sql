CREATE TABLE "import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_url" text NOT NULL,
	"source_date" text NOT NULL,
	"expected_count" integer NOT NULL,
	"imported_count" integer NOT NULL,
	"batch_count" integer NOT NULL,
	"completed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "source_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "assignments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "import_run_id" uuid;