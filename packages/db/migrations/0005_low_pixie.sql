CREATE TABLE "report_catalog_entries" (
	"run_id" uuid NOT NULL,
	"document_id" text NOT NULL,
	"designation" text NOT NULL,
	"title" text NOT NULL,
	"source_date" text,
	"page" integer NOT NULL,
	CONSTRAINT "report_catalog_entries_run_id_document_id_pk" PRIMARY KEY("run_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "report_catalog_pages" (
	"run_id" uuid NOT NULL,
	"page" integer NOT NULL,
	"source_url" text NOT NULL,
	"source_hash" text NOT NULL,
	"item_count" integer NOT NULL,
	CONSTRAINT "report_catalog_pages_run_id_page_pk" PRIMARY KEY("run_id","page")
);
--> statement-breakpoint
CREATE TABLE "report_catalog_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session" text NOT NULL,
	"source_url" text NOT NULL,
	"source_hash" text NOT NULL,
	"expected_count" integer NOT NULL,
	"page_count" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "report_catalog_entries" ADD CONSTRAINT "report_catalog_entries_run_id_page_report_catalog_pages_run_id_page_fk" FOREIGN KEY ("run_id","page") REFERENCES "public"."report_catalog_pages"("run_id","page") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_catalog_pages" ADD CONSTRAINT "report_catalog_pages_run_id_report_catalog_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."report_catalog_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_catalog_runs_session_idx" ON "report_catalog_runs" USING btree ("session","completed_at");