CREATE TABLE "decision_source_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" text NOT NULL,
	"session" text NOT NULL,
	"availability" text NOT NULL,
	"reason" text,
	"source_url" text NOT NULL,
	"source_hash" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_attempts" ADD COLUMN "unavailable_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "decision_source_checks_document_idx" ON "decision_source_checks" USING btree ("document_id","session","checked_at");