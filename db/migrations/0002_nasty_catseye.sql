CREATE TABLE "movement_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_id" uuid,
	"acting_role" text NOT NULL,
	"record_type" text NOT NULL,
	"record_id" uuid NOT NULL,
	"record_identifier" text NOT NULL,
	"source_status" text NOT NULL,
	"destination_status" text NOT NULL,
	"operation_instance_id" uuid,
	"revision_label" text DEFAULT 'A' NOT NULL,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit" text DEFAULT 'EA' NOT NULL,
	"condition" text DEFAULT 'pass' NOT NULL,
	"reason" text,
	"notes" text,
	"workstation_id" uuid,
	"device_id" uuid,
	"idempotency_key" text NOT NULL,
	"client_timestamp" timestamp with time zone,
	"server_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movement_events" ADD CONSTRAINT "movement_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_events" ADD CONSTRAINT "movement_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_events" ADD CONSTRAINT "movement_events_operation_instance_id_operation_instances_id_fk" FOREIGN KEY ("operation_instance_id") REFERENCES "public"."operation_instances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_events" ADD CONSTRAINT "movement_events_workstation_id_workstations_id_fk" FOREIGN KEY ("workstation_id") REFERENCES "public"."workstations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_events" ADD CONSTRAINT "movement_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "movement_events_org_idempotency_unique" ON "movement_events" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "movement_events_record_idx" ON "movement_events" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "movement_events_org_time_idx" ON "movement_events" USING btree ("organization_id","server_timestamp");