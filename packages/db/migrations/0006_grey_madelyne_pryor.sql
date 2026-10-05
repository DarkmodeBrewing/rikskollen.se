CREATE TABLE "import_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset" text NOT NULL,
	"job" text NOT NULL,
	"session" text,
	"document_id" text,
	"status" text DEFAULT 'running' NOT NULL,
	"expected_count" integer,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"snapshot_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "import_attempts_started_idx" ON "import_attempts" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "import_attempts_job_idx" ON "import_attempts" USING btree ("job","started_at");