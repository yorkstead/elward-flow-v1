CREATE TABLE "panel_mark_remakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"remake_type" text NOT NULL,
	"remake_mark" text NOT NULL,
	"sequence_number" integer DEFAULT 51 NOT NULL,
	"original_panel_mark_id" uuid NOT NULL,
	"replacement_panel_mark_id" uuid,
	"quality_issue_id" uuid,
	"responsible_area" text NOT NULL,
	"material_cost" numeric(12, 4) DEFAULT '0',
	"labor_hours" numeric(10, 2) DEFAULT '0',
	"labor_cost" numeric(12, 4) DEFAULT '0',
	"outside_cost" numeric(12, 4) DEFAULT '0',
	"total_cost" numeric(12, 4) DEFAULT '0',
	"approved_by_id" uuid,
	"status" text DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quality_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"release_revision_id" uuid,
	"panel_mark_id" uuid NOT NULL,
	"operation_instance_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"inspector_id" uuid,
	"specification_version" text DEFAULT 'v1.0' NOT NULL,
	"measurements" jsonb,
	"disposition" text NOT NULL,
	"notes" text,
	"destination" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quality_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"issue_number" text NOT NULL,
	"category" text NOT NULL,
	"severity" text DEFAULT 'Moderate' NOT NULL,
	"detection_point" text NOT NULL,
	"suspected_cause" text,
	"responsible_department" text NOT NULL,
	"owner_id" uuid,
	"due_date" timestamp with time zone,
	"affected_quantity" integer DEFAULT 1 NOT NULL,
	"containment_action" text,
	"disposition" text DEFAULT 'Hold' NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"resolution_notes" text,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	"release_id" uuid,
	"panel_mark_id" uuid,
	"operation_instance_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "panel_marks" ADD COLUMN "is_remake" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "panel_marks" ADD COLUMN "original_mark_id" uuid;--> statement-breakpoint
ALTER TABLE "panel_marks" ADD COLUMN "remake_type" text;--> statement-breakpoint
ALTER TABLE "panel_marks" ADD COLUMN "remake_sequence" integer;--> statement-breakpoint
ALTER TABLE "panel_mark_remakes" ADD CONSTRAINT "panel_mark_remakes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_mark_remakes" ADD CONSTRAINT "panel_mark_remakes_original_panel_mark_id_panel_marks_id_fk" FOREIGN KEY ("original_panel_mark_id") REFERENCES "public"."panel_marks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_mark_remakes" ADD CONSTRAINT "panel_mark_remakes_replacement_panel_mark_id_panel_marks_id_fk" FOREIGN KEY ("replacement_panel_mark_id") REFERENCES "public"."panel_marks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_mark_remakes" ADD CONSTRAINT "panel_mark_remakes_quality_issue_id_quality_issues_id_fk" FOREIGN KEY ("quality_issue_id") REFERENCES "public"."quality_issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_mark_remakes" ADD CONSTRAINT "panel_mark_remakes_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_release_revision_id_release_revisions_id_fk" FOREIGN KEY ("release_revision_id") REFERENCES "public"."release_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_panel_mark_id_panel_marks_id_fk" FOREIGN KEY ("panel_mark_id") REFERENCES "public"."panel_marks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_operation_instance_id_operation_instances_id_fk" FOREIGN KEY ("operation_instance_id") REFERENCES "public"."operation_instances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_issues" ADD CONSTRAINT "quality_issues_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_issues" ADD CONSTRAINT "quality_issues_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_issues" ADD CONSTRAINT "quality_issues_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_issues" ADD CONSTRAINT "quality_issues_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_issues" ADD CONSTRAINT "quality_issues_panel_mark_id_panel_marks_id_fk" FOREIGN KEY ("panel_mark_id") REFERENCES "public"."panel_marks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_issues" ADD CONSTRAINT "quality_issues_operation_instance_id_operation_instances_id_fk" FOREIGN KEY ("operation_instance_id") REFERENCES "public"."operation_instances"("id") ON DELETE set null ON UPDATE no action;