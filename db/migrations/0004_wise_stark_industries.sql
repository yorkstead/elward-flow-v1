CREATE TABLE "cycle_count_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"location_id" uuid,
	"system_quantity" numeric(12, 4) NOT NULL,
	"counted_quantity" numeric(12, 4),
	"discrepancy_quantity" numeric(12, 4),
	"is_reconciled" boolean DEFAULT false NOT NULL,
	"reconciliation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycle_count_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_number" text NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"is_blind_mode" boolean DEFAULT true NOT NULL,
	"scope_zone" text DEFAULT 'All Warehouse' NOT NULL,
	"counted_by_id" uuid,
	"approved_by_id" uuid,
	"notes" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_number" text NOT NULL,
	"material_family" text NOT NULL,
	"description" text NOT NULL,
	"manufacturer" text,
	"color" text,
	"finish" text,
	"thickness" numeric(10, 4),
	"width" numeric(10, 4),
	"length" numeric(10, 4),
	"unit" text DEFAULT 'sheets' NOT NULL,
	"reorder_point" numeric(12, 4) DEFAULT '10',
	"reorder_quantity" numeric(12, 4) DEFAULT '20',
	"unit_cost" numeric(12, 4) DEFAULT '0',
	"status" text DEFAULT 'Active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"zone" text DEFAULT 'Warehouse' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"location_id" uuid,
	"transaction_type" text NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"unit" text DEFAULT 'sheets' NOT NULL,
	"lot_number" text,
	"heat_number" text,
	"condition" text DEFAULT 'good' NOT NULL,
	"release_id" uuid,
	"panel_mark_id" uuid,
	"operation_instance_id" uuid,
	"purchase_order_id" uuid,
	"purchase_order_line_id" uuid,
	"count_session_id" uuid,
	"actor_id" uuid,
	"acting_role" text NOT NULL,
	"reason" text,
	"notes" text,
	"server_timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"panel_mark_id" uuid,
	"allocated_quantity" numeric(12, 4) NOT NULL,
	"issued_quantity" numeric(12, 4) DEFAULT '0' NOT NULL,
	"consumed_quantity" numeric(12, 4) DEFAULT '0' NOT NULL,
	"unit" text DEFAULT 'sheets' NOT NULL,
	"is_substituted" boolean DEFAULT false NOT NULL,
	"original_item_id" uuid,
	"substitution_reason" text,
	"allocated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"description" text NOT NULL,
	"ordered_quantity" numeric(12, 4) NOT NULL,
	"received_quantity" numeric(12, 4) DEFAULT '0' NOT NULL,
	"unit" text DEFAULT 'sheets' NOT NULL,
	"unit_price" numeric(12, 4) DEFAULT '0',
	"status" text DEFAULT 'Open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"po_number" text NOT NULL,
	"vendor_name" text NOT NULL,
	"status" text DEFAULT 'Issued' NOT NULL,
	"order_date" timestamp with time zone DEFAULT now() NOT NULL,
	"expected_date" timestamp with time zone,
	"release_id" uuid,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_session_id_cycle_count_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."cycle_count_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_count_sessions" ADD CONSTRAINT "cycle_count_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_count_sessions" ADD CONSTRAINT "cycle_count_sessions_counted_by_id_users_id_fk" FOREIGN KEY ("counted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_count_sessions" ADD CONSTRAINT "cycle_count_sessions_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."inventory_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_panel_mark_id_panel_marks_id_fk" FOREIGN KEY ("panel_mark_id") REFERENCES "public"."panel_marks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_operation_instance_id_operation_instances_id_fk" FOREIGN KEY ("operation_instance_id") REFERENCES "public"."operation_instances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_purchase_order_line_id_purchase_order_lines_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_count_session_id_cycle_count_sessions_id_fk" FOREIGN KEY ("count_session_id") REFERENCES "public"."cycle_count_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_allocations" ADD CONSTRAINT "material_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_allocations" ADD CONSTRAINT "material_allocations_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_allocations" ADD CONSTRAINT "material_allocations_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_allocations" ADD CONSTRAINT "material_allocations_panel_mark_id_panel_marks_id_fk" FOREIGN KEY ("panel_mark_id") REFERENCES "public"."panel_marks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_allocations" ADD CONSTRAINT "material_allocations_original_item_id_inventory_items_id_fk" FOREIGN KEY ("original_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_allocations" ADD CONSTRAINT "material_allocations_allocated_by_id_users_id_fk" FOREIGN KEY ("allocated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_org_item_number_unique" ON "inventory_items" USING btree ("organization_id","item_number");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_locations_org_code_unique" ON "inventory_locations" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "inv_trans_org_time_idx" ON "inventory_transactions" USING btree ("organization_id","server_timestamp");--> statement-breakpoint
CREATE INDEX "inv_trans_item_idx" ON "inventory_transactions" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "inv_trans_type_idx" ON "inventory_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_org_po_number_unique" ON "purchase_orders" USING btree ("organization_id","po_number");