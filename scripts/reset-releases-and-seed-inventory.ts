import { eq, ne, and } from 'drizzle-orm'
import { db, pool } from '@/db'
import {
  organizations,
  users,
  customers,
  projects,
  productionJobs,
  releases,
  releaseRevisions,
  panelMarks,
  operationInstances,
  productionDowntimeEvents,
  movementEvents,
  documents,
  documentRevisions,
  qualityInspections,
  qualityIssues,
  panelMarkRemakes,
  pallets,
  palletItems,
  shipments,
  shipmentPallets,
  inventoryItems,
  inventoryLocations,
  inventoryTransactions,
  purchaseOrders,
  purchaseOrderLines,
} from '@/db/schema'

async function resetReleasesAndSeedInventory() {
  console.log(
    '--- Clearing Release Test Data & Seeding Aligned Inventory & POs ---',
  )

  // 1. Get Primary Organization & Admin User
  const [organization] = await db.select().from(organizations).limit(1)

  if (!organization) {
    throw new Error('No organization found. Please run bun run db:seed first.')
  }

  const [adminUser] = await db
    .select()
    .from(users)
    .where(eq(users.organizationId, organization.id))
    .limit(1)

  if (!adminUser) {
    throw new Error('No user found in organization.')
  }

  console.log(`Found organization: ${organization.name} (${organization.id})`)

  // 2. Clear all release-specific test records and ALL jobs
  console.log(
    '1. Clearing shipments, pallets, quality records, movements, operations, documents, releases, and ALL jobs...',
  )

  await db
    .delete(purchaseOrderLines)
  await db
    .delete(purchaseOrders)
    .where(eq(purchaseOrders.organizationId, organization.id))
  await db
    .delete(inventoryTransactions)
    .where(eq(inventoryTransactions.organizationId, organization.id))
  await db
    .delete(shipmentPallets)
    .where(eq(shipmentPallets.organizationId, organization.id))
  await db
    .delete(shipments)
    .where(eq(shipments.organizationId, organization.id))
  await db
    .delete(palletItems)
    .where(eq(palletItems.organizationId, organization.id))
  await db.delete(pallets).where(eq(pallets.organizationId, organization.id))
  await db
    .delete(panelMarkRemakes)
    .where(eq(panelMarkRemakes.organizationId, organization.id))
  await db
    .delete(qualityIssues)
    .where(eq(qualityIssues.organizationId, organization.id))
  await db
    .delete(qualityInspections)
    .where(eq(qualityInspections.organizationId, organization.id))
  await db
    .delete(movementEvents)
    .where(eq(movementEvents.organizationId, organization.id))
  await db
    .delete(productionDowntimeEvents)
    .where(eq(productionDowntimeEvents.organizationId, organization.id))
  await db
    .delete(operationInstances)
    .where(eq(operationInstances.organizationId, organization.id))
  await db
    .delete(panelMarks)
    .where(eq(panelMarks.organizationId, organization.id))
  await db.delete(documentRevisions)
  await db
    .delete(documents)
    .where(eq(documents.organizationId, organization.id))
  await db
    .delete(releaseRevisions)
    .where(eq(releaseRevisions.organizationId, organization.id))
  await db.delete(releases).where(eq(releases.organizationId, organization.id))
  await db
    .delete(productionJobs)
    .where(eq(productionJobs.organizationId, organization.id))

  console.log(
    '✓ All jobs, releases, and test data cleared completely. System is a clean slate ready for fresh release intake.',
  )

  // 4. Seed Inventory Locations
  console.log('2. Seeding Warehouse & Shop Inventory Locations...')
  const defaultLocations = [
    { code: 'BAY-A1', name: 'Sheet Goods Rack Bay A-1', zone: 'Warehouse' },
    { code: 'BAY-A2', name: 'Sheet Goods Rack Bay A-2', zone: 'Warehouse' },
    {
      code: 'RACK-EXT-01',
      name: 'Extrusion Cantilever Rack 1',
      zone: 'Warehouse',
    },
    {
      code: 'BIN-HW-01',
      name: 'Hardware & Fasteners Bin 1',
      zone: 'Shop Floor',
    },
    { code: 'RECV-01', name: 'Inbound Receiving Dock', zone: 'Dock' },
    { code: 'STAGE-01', name: 'Pre-Production Staging Area', zone: 'Staging' },
  ]

  const locationMap: Record<string, string> = {}
  for (const loc of defaultLocations) {
    const [saved] = await db
      .insert(inventoryLocations)
      .values({
        organizationId: organization.id,
        code: loc.code,
        name: loc.name,
        zone: loc.zone,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [inventoryLocations.organizationId, inventoryLocations.code],
        set: { name: loc.name, zone: loc.zone, updatedAt: new Date() },
      })
      .returning()
    locationMap[loc.code] = saved.id
  }

  // 5. Seed Inventory Items (ACM, Extrusions, Fasteners)
  console.log('3. Seeding Raw Materials & Inventory Items...')
  const defaultItems = [
    {
      itemNumber: 'ACM-CG-4896',
      materialFamily: 'ACM',
      description: '4mm ACM Panel Sheet — Charcoal Grey (48" × 96")',
      manufacturer: 'Mitsubishi Chemical America',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      thickness: '0.1575',
      width: '48.0000',
      length: '96.0000',
      unit: 'sheets',
      reorderPoint: '20',
      reorderQuantity: '50',
      unitCost: '142.00',
    },
    {
      itemNumber: 'ACM-BS-48120',
      materialFamily: 'ACM',
      description: '4mm ACM Panel Sheet — Bright Silver Metallic (48" × 120")',
      manufacturer: 'Mitsubishi Chemical America',
      color: 'Bright Silver',
      finish: 'Metallic 3-Coat PVDF',
      thickness: '0.1575',
      width: '48.0000',
      length: '120.0000',
      unit: 'sheets',
      reorderPoint: '15',
      reorderQuantity: '40',
      unitCost: '155.00',
    },
    {
      itemNumber: 'ACM-BW-48120',
      materialFamily: 'ACM',
      description: '4mm ACM Panel Sheet — Bone White (48" × 120")',
      manufacturer: 'Alpolic Materials Inc.',
      color: 'Bone White',
      finish: 'Solid 2-Coat PVDF',
      thickness: '0.1575',
      width: '48.0000',
      length: '120.0000',
      unit: 'sheets',
      reorderPoint: '20',
      reorderQuantity: '60',
      unitCost: '138.00',
    },
    {
      itemNumber: 'ACM-CB-48120',
      materialFamily: 'ACM',
      description: '4mm ACM Panel Sheet — Classic Bronze (48" × 120")',
      manufacturer: 'Alpolic Materials Inc.',
      color: 'Classic Bronze',
      finish: 'Mica 2-Coat PVDF',
      thickness: '0.1575',
      width: '48.0000',
      length: '120.0000',
      unit: 'sheets',
      reorderPoint: '10',
      reorderQuantity: '30',
      unitCost: '148.00',
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
    },
    {
      itemNumber: 'GSKT-EPDM-500',
      materialFamily: 'Gasket',
      description: 'Continuous EPDM Weather Gasket (500ft Spool)',
      manufacturer: 'Sealant & Gasket Solutions',
      color: 'Black',
      finish: 'Extruded EPDM',
      thickness: '0.2500',
      width: '0.5000',
      length: '6000.0000',
      unit: 'ft',
      reorderPoint: '1000',
      reorderQuantity: '2500',
      unitCost: '0.45',
    },
  ]

  const itemMap: Record<string, string> = {}
  for (const item of defaultItems) {
    const [saved] = await db
      .insert(inventoryItems)
      .values({
        organizationId: organization.id,
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
      .onConflictDoUpdate({
        target: [inventoryItems.organizationId, inventoryItems.itemNumber],
        set: {
          description: item.description,
          manufacturer: item.manufacturer,
          color: item.color,
          unitCost: item.unitCost,
          updatedAt: new Date(),
        },
      })
      .returning()
    itemMap[item.itemNumber] = saved.id
  }

  // 6. Reset & Seed Opening Balance Stock Transactions
  console.log('4. Seeding Physical Stock Balances & Lots...')
  await db
    .delete(inventoryTransactions)
    .where(eq(inventoryTransactions.organizationId, organization.id))

  await db.insert(inventoryTransactions).values([
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['ACM-CG-4896'],
      locationId: locationMap['BAY-A1'],
      transactionType: 'opening_balance',
      quantity: '60.0000',
      unit: 'sheets',
      lotNumber: 'LOT-2026-0815-CG',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Physical inventory baseline',
      notes: 'Initial warehouse stock for Job 25036 Charcoal Grey panels',
    },
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['ACM-BS-48120'],
      locationId: locationMap['BAY-A2'],
      transactionType: 'opening_balance',
      quantity: '40.0000',
      unit: 'sheets',
      lotNumber: 'LOT-2026-0818-BS',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Physical inventory baseline',
      notes: 'Initial warehouse stock for Job 25036 Bright Silver panels',
    },
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['ACM-BW-48120'],
      locationId: locationMap['BAY-A2'],
      transactionType: 'opening_balance',
      quantity: '25.0000',
      unit: 'sheets',
      lotNumber: 'LOT-2026-0819-BW',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Physical inventory baseline',
      notes: 'Stock for Bone White accents',
    },
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['ALU-EXT-4001'],
      locationId: locationMap['RACK-EXT-01'],
      transactionType: 'opening_balance',
      quantity: '720.0000',
      unit: 'ft',
      lotNumber: 'LOT-EXT-4001-A',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Extrusion rack stock count (30 bars x 24ft)',
      notes: 'Standard 4001 perimeter profile',
    },
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['ALU-EXT-4002'],
      locationId: locationMap['RACK-EXT-01'],
      transactionType: 'opening_balance',
      quantity: '480.0000',
      unit: 'ft',
      lotNumber: 'LOT-EXT-4002-A',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Extrusion rack stock count (20 bars x 24ft)',
      notes: 'Standard 4002 intermediate stiffener profile',
    },
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['CLIP-ALU-25'],
      locationId: locationMap['BIN-HW-01'],
      transactionType: 'opening_balance',
      quantity: '1500.0000',
      unit: 'pcs',
      lotNumber: 'LOT-CLIP-2026-08',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Hardware bin baseline',
      notes: 'Standard mounting clips',
    },
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['RIVET-SS-316'],
      locationId: locationMap['BIN-HW-01'],
      transactionType: 'opening_balance',
      quantity: '5000.0000',
      unit: 'pcs',
      lotNumber: 'LOT-RIV-2026-08',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Hardware bin baseline',
      notes: 'Standard stainless blind rivets',
    },
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['GSKT-EPDM-500'],
      locationId: locationMap['BIN-HW-01'],
      transactionType: 'opening_balance',
      quantity: '2000.0000',
      unit: 'ft',
      lotNumber: 'LOT-GSK-2026-08',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Weather gasket 4 spools count',
      notes: '500ft rolls',
    },
  ])

  // 7. Reset & Seed Purchase Orders
  console.log(
    '5. Seeding Purchase Orders aligned with Job 25036 Release Intake...',
  )
  await db.delete(purchaseOrderLines)
  await db
    .delete(purchaseOrders)
    .where(eq(purchaseOrders.organizationId, organization.id))

  // PO-94101 (Mitsubishi Chemical - Issued)
  const [po1] = await db
    .insert(purchaseOrders)
    .values({
      organizationId: organization.id,
      poNumber: 'PO-94101',
      vendorName: 'Mitsubishi Chemical America',
      status: 'Issued',
      orderDate: new Date(Date.now() - 86400000 * 2), // 2 days ago
      expectedDate: new Date(Date.now() + 86400000 * 3), // in 3 days
      notes: 'Material for Job 25036 Releases 1 & 2 ACM panel routing',
    })
    .returning()

  await db.insert(purchaseOrderLines).values([
    {
      purchaseOrderId: po1.id,
      lineNumber: 1,
      inventoryItemId: itemMap['ACM-CG-4896'],
      description: '4mm ACM Panel Sheet — Charcoal Grey (48" × 96")',
      orderedQuantity: '50.0000',
      receivedQuantity: '0.0000',
      unit: 'sheets',
      unitPrice: '142.00',
      status: 'Open',
    },
    {
      purchaseOrderId: po1.id,
      lineNumber: 2,
      inventoryItemId: itemMap['ACM-BS-48120'],
      description: '4mm ACM Panel Sheet — Bright Silver Metallic (48" × 120")',
      orderedQuantity: '30.0000',
      receivedQuantity: '0.0000',
      unit: 'sheets',
      unitPrice: '155.00',
      status: 'Open',
    },
  ])

  // PO-94102 (Alpolic Materials - Partially Received)
  const [po2] = await db
    .insert(purchaseOrders)
    .values({
      organizationId: organization.id,
      poNumber: 'PO-94102',
      vendorName: 'Alpolic Materials Inc.',
      status: 'Partially Received',
      orderDate: new Date(Date.now() - 86400000 * 5),
      expectedDate: new Date(Date.now() + 86400000 * 1), // tomorrow
      notes: 'Accent sheet order for phase 2 architectural envelope',
    })
    .returning()

  await db.insert(purchaseOrderLines).values([
    {
      purchaseOrderId: po2.id,
      lineNumber: 1,
      inventoryItemId: itemMap['ACM-BW-48120'],
      description: '4mm ACM Panel Sheet — Bone White (48" × 120")',
      orderedQuantity: '40.0000',
      receivedQuantity: '20.0000',
      unit: 'sheets',
      unitPrice: '138.00',
      status: 'Partially Received',
    },
    {
      purchaseOrderId: po2.id,
      lineNumber: 2,
      inventoryItemId: itemMap['ACM-CB-48120'],
      description: '4mm ACM Panel Sheet — Classic Bronze (48" × 120")',
      orderedQuantity: '25.0000',
      receivedQuantity: '0.0000',
      unit: 'sheets',
      unitPrice: '148.00',
      status: 'Open',
    },
  ])

  // PO-94103 (Elward Standard Extrusions - Issued)
  const [po3] = await db
    .insert(purchaseOrders)
    .values({
      organizationId: organization.id,
      poNumber: 'PO-94103',
      vendorName: 'Elward Standard Extrusions',
      status: 'Issued',
      orderDate: new Date(Date.now() - 86400000 * 1),
      expectedDate: new Date(Date.now() + 86400000 * 5),
      notes: 'Stock replenishment for 24ft ELU saw extrusions and stiffeners',
    })
    .returning()

  await db.insert(purchaseOrderLines).values([
    {
      purchaseOrderId: po3.id,
      lineNumber: 1,
      inventoryItemId: itemMap['ALU-EXT-4001'],
      description: 'Perimeter Extrusion Profile 4001 (24ft Stock Length)',
      orderedQuantity: '1200.0000',
      receivedQuantity: '0.0000',
      unit: 'ft',
      unitPrice: '4.25',
      status: 'Open',
    },
    {
      purchaseOrderId: po3.id,
      lineNumber: 2,
      inventoryItemId: itemMap['ALU-EXT-4002'],
      description: 'Intermediate Stiffener Profile 4002 (24ft Stock Length)',
      orderedQuantity: '720.0000',
      receivedQuantity: '0.0000',
      unit: 'ft',
      unitPrice: '3.80',
      status: 'Open',
    },
  ])

  // PO-94104 (Fastener Supply Co. - Received)
  const [po4] = await db
    .insert(purchaseOrders)
    .values({
      organizationId: organization.id,
      poNumber: 'PO-94104',
      vendorName: 'Fastener Supply Co.',
      status: 'Received',
      orderDate: new Date(Date.now() - 86400000 * 7),
      expectedDate: new Date(Date.now() - 86400000 * 1),
      notes: 'Assembly clips and fasteners shipment',
    })
    .returning()

  await db.insert(purchaseOrderLines).values([
    {
      purchaseOrderId: po4.id,
      lineNumber: 1,
      inventoryItemId: itemMap['CLIP-ALU-25'],
      description: 'Heavy Duty Attachment Clips - 2.5" Extruded Aluminum',
      orderedQuantity: '2000.0000',
      receivedQuantity: '2000.0000',
      unit: 'pcs',
      unitPrice: '0.85',
      status: 'Closed',
    },
    {
      purchaseOrderId: po4.id,
      lineNumber: 2,
      inventoryItemId: itemMap['RIVET-SS-316'],
      description: 'Structural Blind Rivets 3/16" 316 Stainless Steel',
      orderedQuantity: '10000.0000',
      receivedQuantity: '10000.0000',
      unit: 'pcs',
      unitPrice: '0.12',
      status: 'Closed',
    },
  ])

  console.log('✓ Purchase Orders & lines seeded successfully.')
  console.log('--- Database Reset & Inventory Seeding Complete! ---')
  console.log(
    'You can now go to /releases/intake and upload your Release 1 and Release 2 packages fresh.',
  )

  await pool.end()
}

resetReleasesAndSeedInventory().catch((err) => {
  console.error('Error executing resetReleasesAndSeedInventory:', err)
  process.exit(1)
})
