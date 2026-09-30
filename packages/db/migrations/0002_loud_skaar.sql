CREATE TABLE "vote_choices" (
	"run_id" uuid NOT NULL,
	"vote_id" uuid NOT NULL,
	"person_id" text NOT NULL,
	"source_name" text NOT NULL,
	"party_code" text NOT NULL,
	"constituency" text NOT NULL,
	"choice" text NOT NULL,
	CONSTRAINT "vote_choices_run_id_vote_id_person_id_pk" PRIMARY KEY("run_id","vote_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "vote_events" (
	"run_id" uuid NOT NULL,
	"vote_id" uuid NOT NULL,
	"session" text NOT NULL,
	"designation" text NOT NULL,
	"proposal_point" text NOT NULL,
	"document_id" text,
	"subject_type" text NOT NULL,
	"main_vote_type" text NOT NULL,
	"vote_date" text,
	"source_file" text NOT NULL,
	"source_url" text NOT NULL,
	"source_hash" text NOT NULL,
	CONSTRAINT "vote_events_run_id_vote_id_pk" PRIMARY KEY("run_id","vote_id")
);
--> statement-breakpoint
CREATE TABLE "vote_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session" text NOT NULL,
	"source_url" text NOT NULL,
	"source_hash" text NOT NULL,
	"expected_files" integer NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"choice_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "vote_choices" ADD CONSTRAINT "vote_choices_run_id_vote_id_vote_events_run_id_vote_id_fk" FOREIGN KEY ("run_id","vote_id") REFERENCES "public"."vote_events"("run_id","vote_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_events" ADD CONSTRAINT "vote_events_run_id_vote_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."vote_import_runs"("id") ON DELETE cascade ON UPDATE no action;