import { db } from '@/db'
import {
  organizations,
  sites,
  users,
  workstations,
  operationDefinitions,
  inventoryLocations,
  inventoryItems,
  inventoryTransactions,
  purchaseOrders,
  purchaseOrderLines,
  productionJobs,
} from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

let systemFoundationInitialized = false

/**
 * Ensures standard organization shop-floor foundation (Workstations, Operations,
 * Inventory Items & Locations, Purchase Orders) exists and cleans up legacy test jobs (like 59001).
 */
export async function ensureSystemFoundationPopulated(
  organizationId?: string,
): Promise<void> {
  if (systemFoundationInitialized) return

  try {
    // 1. Delete legacy 59001 test jobs
    await db.execute(sql`
      DELETE FROM "production_jobs" WHERE "job_number" = '59001';
    `)

    // 2. Resolve organization
    let orgId = organizationId
    if (!orgId || orgId === 'undefined') {
      const [firstOrg] = await db.select().from(organizations).limit(1)
      if (firstOrg) orgId = firstOrg.id
    }

    if (!orgId) return

    // 3. Ensure primary site exists
    let [site] = await db
      .select()
      .from(sites)
      .where(eq(sites.organizationId, orgId))
      .limit(1)

    if (!site) {
      ;[site] = await db
        .insert(sites)
        .values({
          organizationId: orgId,
          name: 'Elward Systems Primary Plant',
          code: 'MAIN',
          isProductionFacility: true,
          timezone: 'America/Denver',
        })
        .returning()
    }

    // 4. Ensure Workstations (Scan Stations)
    const stationConfigs = [
      { name: 'CNC Router 01 (5x12 Vacuum Table)', code: 'CNC-01', department: 'CNC' },
      { name: 'CNC Router 02 (5x12 Vacuum Table)', code: 'CNC-02', department: 'CNC' },
      { name: 'CNC Router 03 (5x10 Bed)', code: 'CNC-03', department: 'CNC' },
      { name: 'ELU Miter Saw Station 01', code: 'ELU-01', department: 'ELU' },
      { name: 'ELU Miter Saw Station 02', code: 'ELU-02', department: 'ELU' },
      { name: 'Parts Preparation Area', code: 'PREP-01', department: 'Parts Prep' },
      { name: 'Assembly Line 1 - Frame Assembly', code: 'ASSY-R1-S1', department: 'Assembly' },
      { name: 'Assembly Line 1 - Stiffener & Hardware', code: 'ASSY-R1-S2', department: 'Assembly' },
      { name: 'Assembly Line 1 - Final Gasketing', code: 'ASSY-R1-S3', department: 'Assembly' },
      { name: 'Assembly Line 2 - Frame Assembly', code: 'ASSY-R2-S1', department: 'Assembly' },
      { name: 'Assembly Line 2 - Stiffener & Hardware', code: 'ASSY-R2-S2', department: 'Assembly' },
      { name: 'Quality Inspection Area', code: 'QC-01', department: 'QC' },
      { name: 'Palletizing & Staging Dock', code: 'PAL-01', department: 'Palletizing' },
      { name: 'Packaging & Shipping Dock', code: 'SHIP-01', department: 'Shipping' },
    ]

    for (const s of stationConfigs) {
      const [existing] = await db
        .select()
        .from(workstations)
        .where(and(eq(workstations.siteId, site.id), eq(workstations.code, s.code)))
        .limit(1)

      if (!existing) {
        await db.insert(workstations).values({
          siteId: site.id,
          name: s.name,
          code: s.code,
          department: s.department,
          isActive: true,
        })
      }
    }

    // 5. Ensure Operation Definitions
    const opDefs = [
      { code: 'OP-CNC', name: 'CNC Panel Routing & V-Grooving', department: 'CNC', sequence: 10 },
      { code: 'OP-ELU', name: 'ELU Extrusion Cutting', department: 'ELU', sequence: 20 },
      { code: 'OP-PREP', name: 'Parts Prep & Flange Pre-Drill', department: 'Parts Prep', sequence: 30 },
      { code: 'OP-ASSY', name: 'Panel Frame Assembly & Gasketing', department: 'Assembly', sequence: 40 },
      { code: 'OP-QC', name: 'Quality Inspection', department: 'QC', sequence: 50 },
      { code: 'OP-PACK', name: 'Final Inspection & Packaging', department: 'Shipping', sequence: 60 },
    ]

    for (const op of opDefs) {
      const [existing] = await db
        .select()
        .from(operationDefinitions)
        .where(
          and(
            eq(operationDefinitions.organizationId, orgId),
            eq(operationDefinitions.code, op.code),
          ),
        )
        .limit(1)

      if (!existing) {
        await db.insert(operationDefinitions).values({
          organizationId: orgId,
          code: op.code,
          name: op.name,
          department: op.department,
          defaultSequence: op.sequence,
        })
      }
    }

    // 6. Ensure Inventory Locations
    const defaultLocations = [
      { code: 'BAY-A1', name: 'Warehouse Bay A-01 (ACM Sheets)', zone: 'Raw Materials', type: 'Storage' },
      { code: 'BAY-A2', name: 'Warehouse Bay A-02 (ACM Accent Sheets)', zone: 'Raw Materials', type: 'Storage' },
      { code: 'RACK-EXT-01', name: 'Extrusion Cantilever Rack 01', zone: 'Extrusions', type: 'Storage' },
      { code: 'BIN-HW-01', name: 'Hardware Bins Row 1', zone: 'Hardware', type: 'Storage' },
      { code: 'STAGE-01', name: 'Pallet Staging Bay 01', zone: 'Staging', type: 'Staging' },
      { code: 'SHIP-DOCK-01', name: 'Shipping Dock A', zone: 'Shipping', type: 'Shipping' },
    ]

    const locationMap: Record<string, string> = {}
    for (const loc of defaultLocations) {
      let [saved] = await db
        .select()
        .from(inventoryLocations)
        .where(
          and(
            eq(inventoryLocations.organizationId, orgId),
            eq(inventoryLocations.code, loc.code),
          ),
        )
        .limit(1)

      if (!saved) {
        ;[saved] = await db
          .insert(inventoryLocations)
          .values({
            organizationId: orgId,
            code: loc.code,
            name: loc.name,
            zone: loc.zone,
            isActive: true,
          })
          .returning()
      }
      locationMap[loc.code] = saved.id
    }

    // 7. Ensure Inventory Items & Stock Balances
    const defaultItems = [
      {
        itemNumber: 'ACM-CG-4896',
        materialFamily: 'ACM',
        description: '4mm ACM Panel Sheet — Charcoal Grey (48" × 96")',
        manufacturer: 'Mitsubishi Chemical America',
        color: 'Charcoal Grey',
        finish: 'Matte PVDF',
        thickness: '0.1570',
        width: '48.0000',
        length: '96.0000',
        unit: 'sheets',
        reorderPoint: '20',
        reorderQuantity: '50',
        unitCost: '142.00',
        initialStock: '60.0000',
        locationCode: 'BAY-A1',
      },
      {
        itemNumber: 'ACM-BS-48120',
        materialFamily: 'ACM',
        description: '4mm ACM Panel Sheet — Bright Silver Metallic (48" × 120")',
        manufacturer: 'Mitsubishi Chemical America',
        color: 'Bright Silver Metallic',
        finish: 'Metallic PVDF',
        thickness: '0.1570',
        width: '48.0000',
        length: '120.0000',
        unit: 'sheets',
        reorderPoint: '15',
        reorderQuantity: '40',
        unitCost: '155.00',
        initialStock: '40.0000',
        locationCode: 'BAY-A2',
      },
      {
        itemNumber: 'ACM-BW-48120',
        materialFamily: 'ACM',
        description: '4mm ACM Panel Sheet — Bone White (48" × 120")',
        manufacturer: 'Alpolic Materials Inc.',
        color: 'Bone White',
        finish: 'Matte PVDF',
        thickness: '0.1570',
        width: '48.0000',
        length: '120.0000',
        unit: 'sheets',
        reorderPoint: '15',
        reorderQuantity: '30',
        unitCost: '138.00',
        initialStock: '25.0000',
        locationCode: 'BAY-A2',
      },
      {
        itemNumber: 'ALU-EXT-4001',
        materialFamily: 'Extrusion',
        description: 'Perimeter Extrusion Profile 4001 (24ft Stock Length)',
        manufacturer: 'Elward Standard Extrusions',
        color: 'Mill Finish',
        finish: 'Mill Finish',
        thickness: '0.1250',
        width: '2.5000',
        length: '288.0000',
        unit: 'ft',
        reorderPoint: '300',
        reorderQuantity: '600',
        unitCost: '4.25',
        initialStock: '720.0000',
        locationCode: 'RACK-EXT-01',
      },
      {
        itemNumber: 'ALU-EXT-4002',
        materialFamily: 'Extrusion',
        description: 'Intermediate Stiffener Profile 4002 (24ft Stock Length)',
        manufacturer: 'Elward Standard Extrusions',
        color: 'Mill Finish',
        finish: 'Mill Finish',
        thickness: '0.1250',
        width: '1.7500',
        length: '288.0000',
        unit: 'ft',
        reorderPoint: '200',
        reorderQuantity: '480',
        unitCost: '3.80',
        initialStock: '480.0000',
        locationCode: 'RACK-EXT-01',
      },
      {
        itemNumber: 'CLIP-ALU-25',
        materialFamily: 'Fastener',
        description: 'Heavy Duty Attachment Clips - 2.5" Extruded Aluminum',
        manufacturer: 'Elward Standard Extrusions',
        color: 'Mill Finish',
        finish: 'Mill Finish',
        thickness: '0.1250',
        width: '2.5000',
        length: '2.5000',
        unit: 'pcs',
        reorderPoint: '500',
        reorderQuantity: '2000',
        unitCost: '0.85',
        initialStock: '1500.0000',
        locationCode: 'BIN-HW-01',
      },
      {
        itemNumber: 'RIVET-SS-316',
        materialFamily: 'Fastener',
        description: 'Structural Blind Rivets 3/16" 316 Stainless Steel',
        manufacturer: 'Fastener Supply Co.',
        color: 'Stainless Steel',
        finish: 'Plain',
        thickness: '0.1875',
        width: '0.1875',
        length: '0.5000',
        unit: 'pcs',
        reorderPoint: '2000',
        reorderQuantity: '10000',
        unitCost: '0.12',
        initialStock: '5000.0000',
        locationCode: 'BIN-HW-01',
      },
    ]

    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.organizationId, orgId))
      .limit(1)

    for (const item of defaultItems) {
      let [savedItem] = await db
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.organizationId, orgId),
            eq(inventoryItems.itemNumber, item.itemNumber),
          ),
        )
        .limit(1)

      if (!savedItem) {
        ;[savedItem] = await db
          .insert(inventoryItems)
          .values({
            organizationId: orgId,
            itemNumber: item.itemNumber,
            materialFamily: item.materialFamily,
            description: item.description,
            manufacturer: item.manufacturer,
            color: item.color,
            finish: item.finish,
            thickness: item.thickness,
            width: item.width,
            length: item.length,
            unit: item.unit,
            reorderPoint: item.reorderPoint,
            reorderQuantity: item.reorderQuantity,
            unitCost: item.unitCost,
            status: 'Active',
          })
          .returning()

        // Insert opening balance transaction
        const targetLocId = locationMap[item.locationCode] || Object.values(locationMap)[0]
        if (targetLocId && adminUser) {
          await db.insert(inventoryTransactions).values({
            organizationId: orgId,
            inventoryItemId: savedItem.id,
            locationId: targetLocId,
            transactionType: 'opening_balance',
            quantity: item.initialStock,
            unit: item.unit,
            lotNumber: `LOT-${item.itemNumber}-INIT`,
            condition: 'good',
            actorId: adminUser.id,
            actingRole: 'System Administrator',
            reason: 'Opening baseline inventory',
          })
        }
      }
    }

    // 8. Ensure Sample Purchase Orders for Materials
    const [existingPo] = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.organizationId, orgId))
      .limit(1)

    if (!existingPo) {
      const [po] = await db
        .insert(purchaseOrders)
        .values({
          organizationId: orgId,
          poNumber: 'PO-94101',
          vendorName: 'Mitsubishi Chemical America',
          status: 'Issued',
          orderDate: new Date(Date.now() - 86400000 * 2),
          expectedDate: new Date(Date.now() + 86400000 * 3),
          notes: 'Material supply for Job 25036 releases',
        })
        .returning()

      const [cgItem] = await db
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.organizationId, orgId),
            eq(inventoryItems.itemNumber, 'ACM-CG-4896'),
          ),
        )
        .limit(1)

      if (cgItem) {
        await db.insert(purchaseOrderLines).values({
          purchaseOrderId: po.id,
          lineNumber: 1,
          inventoryItemId: cgItem.id,
          description: cgItem.description,
          orderedQuantity: '50.0000',
          receivedQuantity: '0.0000',
          unit: 'sheets',
          unitPrice: '142.00',
          status: 'Open',
        })
      }
    }

    systemFoundationInitialized = true
  } catch (err) {
    console.error('ensureSystemFoundationPopulated notice:', err)
  }
}
