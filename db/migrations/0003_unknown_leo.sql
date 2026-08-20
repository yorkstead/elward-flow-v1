CREATE TABLE "production_downtime_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workstation_id" uuid,
	"department" text NOT NULL,
	"category" text NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"duration_minutes" integer,
	"reported_by_id" uuid,
	"resolved_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operation_instances" ADD COLUMN "priority" text DEFAULT 'Standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "operation_instances" ADD COLUMN "assigned_team" text;--> statement-breakpoint
ALTER TABLE "operation_instances" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "operation_instances" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "operation_instances" ADD COLUMN "first_off_inspection" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "operation_instances" ADD COLUMN "first_off_notes" text;--> statement-breakpoint
ALTER TABLE "operation_instances" ADD COLUMN "machine_reference" text;--> statement-breakpoint
ALTER TABLE "operation_instances" ADD COLUMN "layout_reference" text;--> statement-breakpoint
ALTER TABLE "operation_instances" ADD COLUMN "cart_reference" text;--> statement-breakpoint
ALTER TABLE "production_downtime_events" ADD CONSTRAINT "production_downtime_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_downtime_events" ADD CONSTRAINT "production_downtime_events_workstation_id_workstations_id_fk" FOREIGN KEY ("workstation_id") REFERENCES "public"."workstations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_downtime_events" ADD CONSTRAINT "production_downtime_events_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_downtime_events" ADD CONSTRAINT "production_downtime_events_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;