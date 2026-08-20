CREATE TABLE "pallet_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"pallet_id" uuid NOT NULL,
	"panel_mark_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"sequence" integer DEFAULT 1 NOT NULL,
	"staged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"staged_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"pallet_number" text NOT NULL,
	"release_id" uuid NOT NULL,
	"release_revision_id" uuid,
	"status" text DEFAULT 'Draft' NOT NULL,
	"elevation" text,
	"max_height_inches" numeric(10, 2) DEFAULT '60.00' NOT NULL,
	"current_height_inches" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"max_weight_lbs" numeric(10, 2) DEFAULT '2500.00' NOT NULL,
	"current_weight_lbs" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"panel_count" integer DEFAULT 0 NOT NULL,
	"builder_id" uuid,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_pallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"pallet_id" uuid NOT NULL,
	"truck_position" integer,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"loaded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"shipment_number" text NOT NULL,
	"carrier" text DEFAULT 'Dedicated Logistics' NOT NULL,
	"trailer_number" text,
	"driver_name" text,
	"driver_phone" text,
	"bol_number" text,
	"status" text DEFAULT 'Draft' NOT NULL,
	"scheduled_departure" timestamp with time zone,
	"actual_departure" timestamp with time zone,
	"origin_address" text DEFAULT 'Elward Systems Corp Plant 1, Loveland, CO' NOT NULL,
	"destination_address" text,
	"total_weight_lbs" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_pallets" integer DEFAULT 0 NOT NULL,
	"dispatched_by_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pallet_items" ADD CONSTRAINT "pallet_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet_items" ADD CONSTRAINT "pallet_items_pallet_id_pallets_id_fk" FOREIGN KEY ("pallet_id") REFERENCES "public"."pallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet_items" ADD CONSTRAINT "pallet_items_panel_mark_id_panel_marks_id_fk" FOREIGN KEY ("panel_mark_id") REFERENCES "public"."panel_marks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet_items" ADD CONSTRAINT "pallet_items_staged_by_id_users_id_fk" FOREIGN KEY ("staged_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_release_revision_id_release_revisions_id_fk" FOREIGN KEY ("release_revision_id") REFERENCES "public"."release_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_builder_id_users_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_pallets" ADD CONSTRAINT "shipment_pallets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_pallets" ADD CONSTRAINT "shipment_pallets_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_pallets" ADD CONSTRAINT "shipment_pallets_pallet_id_pallets_id_fk" FOREIGN KEY ("pallet_id") REFERENCES "public"."pallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_pallets" ADD CONSTRAINT "shipment_pallets_loaded_by_id_users_id_fk" FOREIGN KEY ("loaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_dispatched_by_id_users_id_fk" FOREIGN KEY ("dispatched_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pallet_items_pallet_id_idx" ON "pallet_items" USING btree ("pallet_id");--> statement-breakpoint
CREATE INDEX "pallet_items_panel_mark_id_idx" ON "pallet_items" USING btree ("panel_mark_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pallets_org_number_unique" ON "pallets" USING btree ("organization_id","pallet_number");--> statement-breakpoint
CREATE INDEX "pallets_release_id_idx" ON "pallets" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "shipment_pallets_shipment_id_idx" ON "shipment_pallets" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "shipment_pallets_pallet_id_idx" ON "shipment_pallets" USING btree ("pallet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_org_number_unique" ON "shipments" USING btree ("organization_id","shipment_number");