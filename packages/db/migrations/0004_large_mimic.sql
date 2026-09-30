CREATE TABLE "decision_documents" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"session" text NOT NULL,
	"designation" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"decision_date" text
);
--> statement-breakpoint
CREATE TABLE "decision_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" text NOT NULL,
	"source_url" text NOT NULL,
	"source_hash" text NOT NULL,
	"expected_points" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "decision_points" (
	"run_id" uuid NOT NULL,
	"point" text NOT NULL,
	"heading" text NOT NULL,
	"proposal_text" text NOT NULL,
	"decision_type" text NOT NULL,
	"winner" text,
	"source_vote_id" uuid,
	CONSTRAINT "decision_points_run_id_point_pk" PRIMARY KEY("run_id","point")
);
--> statement-breakpoint
ALTER TABLE "decision_documents" ADD CONSTRAINT "decision_documents_run_id_decision_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."decision_import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_points" ADD CONSTRAINT "decision_points_run_id_decision_documents_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."decision_documents"("run_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decision_runs_document_idx" ON "decision_import_runs" USING btree ("document_id","completed_at");