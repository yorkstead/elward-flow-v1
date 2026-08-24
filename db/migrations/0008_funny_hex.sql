CREATE TYPE "public"."pallet_plan_status" AS ENUM('Draft', 'Review', 'Approved', 'Applied', 'Superseded', 'Cancelled');--> statement-breakpoint
CREATE TABLE "pallet_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"pallet_plan_pallet_id" uuid NOT NULL,
	"panel_mark_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"sequence" integer DEFAULT 1 NOT NULL,
	"elevation" text,
	"calculated_weight" numeric(10, 2),
	"calculated_height" numeric(10, 2),
	"source_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pallet_plan_pallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"pallet_plan_id" uuid NOT NULL,
	"sequence" integer DEFAULT 1 NOT NULL,
	"planned_pallet_number" text NOT NULL,
	"width_inches" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"length_inches" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"height_inches" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"weight_lbs" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"border_inches" numeric(10, 2) DEFAULT '4.00' NOT NULL,
	"elevations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"material_families" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"panel_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"overrides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pallet_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"release_revision_id" uuid NOT NULL,
	"status" "pallet_plan_status" DEFAULT 'Draft' NOT NULL,
	"algorithm_version" text DEFAULT '1.0.0' NOT NULL,
	"generated_by_id" uuid,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by_id" uuid,
	"approved_at" timestamp with time zone,
	"applied_by_id" uuid,
	"applied_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pallets" ALTER COLUMN "max_weight_lbs" SET DEFAULT '3500.00';--> statement-breakpoint
ALTER TABLE "pallet_items" ADD COLUMN "elevation" text;--> statement-breakpoint
ALTER TABLE "pallet_items" ADD COLUMN "calculated_weight" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "pallet_items" ADD COLUMN "calculated_height" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "pallets" ADD COLUMN "pallet_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "pallets" ADD COLUMN "elevations" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pallets" ADD COLUMN "width_inches" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "pallets" ADD COLUMN "length_inches" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "pallets" ADD COLUMN "border_inches" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "panel_marks" ADD COLUMN "elevation" text;--> statement-breakpoint
ALTER TABLE "panel_marks" ADD COLUMN "source_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "pallet_plan_items" ADD CONSTRAINT "pallet_plan_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet_plan_items" ADD CONSTRAINT "pallet_plan_items_pallet_plan_pallet_id_pallet_plan_pallets_id_fk" FOREIGN KEY ("pallet_plan_pallet_id") REFERENCES "public"."pallet_plan_pallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet_plan_items" ADD CONSTRAINT "pallet_plan_items_panel_mark_id_panel_marks_id_fk" FOREIGN KEY ("panel_mark_id") REFERENCES "public"."panel_marks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet_plan_pallets" ADD CONSTRAINT "pallet_plan_pallets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet_plan_pallets" ADD CONSTRAINT "pallet_plan_pallets_pallet_plan_id_pallet_plans_id_fk" FOREIGN KEY ("pallet_plan_id") REFERENCES "public"."pallet_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet_plans" ADD CONSTRAINT "pallet_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet_plans" ADD CONSTRAINT "pallet_plans_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet_plans" ADD CONSTRAINT "pallet_plans_release_revision_id_release_revisions_id_fk" FOREIGN KEY ("release_revision_id") REFERENCES "public"."release_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet_plans" ADD CONSTRAINT "pallet_plans_generated_by_id_users_id_fk" FOREIGN KEY ("generated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet_plans" ADD CONSTRAINT "pallet_plans_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pallet_plans" ADD CONSTRAINT "pallet_plans_applied_by_id_users_id_fk" FOREIGN KEY ("applied_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pallet_plan_items_pallet_idx" ON "pallet_plan_items" USING btree ("pallet_plan_pallet_id");--> statement-breakpoint
CREATE INDEX "pallet_plan_items_mark_idx" ON "pallet_plan_items" USING btree ("panel_mark_id");--> statement-breakpoint
CREATE INDEX "pallet_plan_pallets_plan_idx" ON "pallet_plan_pallets" USING btree ("pallet_plan_id");--> statement-breakpoint
CREATE INDEX "pallet_plans_org_release_idx" ON "pallet_plans" USING btree ("organization_id","release_id");--> statement-breakpoint
CREATE INDEX "pallet_plans_release_rev_idx" ON "pallet_plans" USING btree ("organization_id","release_revision_id");--> statement-breakpoint
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_pallet_plan_id_pallet_plans_id_fk" FOREIGN KEY ("pallet_plan_id") REFERENCES "public"."pallet_plans"("id") ON DELETE set null ON UPDATE no action;