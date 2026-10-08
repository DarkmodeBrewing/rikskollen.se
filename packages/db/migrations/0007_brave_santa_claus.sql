ALTER TABLE "import_attempts" ADD COLUMN "trigger" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "import_attempts" ADD COLUMN "unchanged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "import_attempts_document_check_idx" ON "import_attempts" USING btree ("job","document_id","status","finished_at");