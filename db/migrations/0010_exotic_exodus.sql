DROP INDEX "shipment_pallets_pallet_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_pallets_pallet_id_unique" ON "shipment_pallets" USING btree ("pallet_id");