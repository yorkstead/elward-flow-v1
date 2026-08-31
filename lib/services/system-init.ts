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
  customers,
  projects,
  releases,
  releaseRevisions,
  panelMarks,
  operationInstances,
  qualityInspections,
  qualityIssues,
  panelMarkRemakes,
  pallets,
  palletItems,
  shipments,
  shipmentPallets,
} from '@/db/schema'
import { eq, and } from 'drizzle-orm'

let systemFoundationInitialized = false

/**
 * Ensures standard organization shop-floor foundation (Workstations, Operations,
 * Inventory Items & Locations, Purchase Orders) and 7 showcase releases exist.
 */
export async function ensureSystemFoundationPopulated(
  organizationId?: string,
): Promise<void> {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.ALLOW_SYNTHETIC_SEED !== 'true'
  )
    throw new Error(
      'Synthetic setup requires an explicit local development seed command.',
    )
  if (systemFoundationInitialized) return

  try {
    // 1. Resolve organization
    let orgId = organizationId
    if (
      !orgId ||
      orgId === 'undefined' ||
      orgId === '00000000-0000-0000-0000-000000000001'
    ) {
      const [firstOrg] = await db.select().from(organizations).limit(1)
      if (firstOrg) {
        orgId = firstOrg.id
      } else {
        const [createdOrg] = await db
          .insert(organizations)
          .values({
            name: 'Ellwood Systems — Local Development',
            slug: 'ellwood-local',
          })
          .onConflictDoNothing()
          .returning()
        if (createdOrg) orgId = createdOrg.id
      }
    }

    if (!orgId) return

    // 2. Ensure primary site exists
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
          name: 'Ellwood Systems Primary Plant',
          code: 'MAIN',
          isProductionFacility: true,
          timezone: 'America/Denver',
        })
        .returning()
    }

    // 3. Ensure Workstations (17 Scan Stations)
    const stationConfigs = [
      {
        name: 'CNC Router 01 (5x12 Vacuum Table)',
        code: 'CNC-01',
        department: 'CNC',
      },
      {
        name: 'CNC Router 02 (5x12 Vacuum Table)',
        code: 'CNC-02',
        department: 'CNC',
      },
      { name: 'CNC Router 03 (5x10 Bed)', code: 'CNC-03', department: 'CNC' },
      { name: 'ELU Miter Saw Station 01', code: 'ELU-01', department: 'ELU' },
      { name: 'ELU Miter Saw Station 02', code: 'ELU-02', department: 'ELU' },
      {
        name: 'Parts Preparation Area',
        code: 'PREP-01',
        department: 'Parts Prep',
      },
      {
        name: 'Assembly Line 1 - Station 1 (Perimeter Frame)',
        code: 'ASSY-R1-S1',
        department: 'Assembly',
      },
      {
        name: 'Assembly Line 1 - Station 2 (Stiffener & Hardware)',
        code: 'ASSY-R1-S2',
        department: 'Assembly',
      },
      {
        name: 'Assembly Line 1 - Station 3 (Final Gasketing)',
        code: 'ASSY-R1-S3',
        department: 'Assembly',
      },
      {
        name: 'Assembly Line 2 - Station 1 (Perimeter Frame)',
        code: 'ASSY-R2-S1',
        department: 'Assembly',
      },
      {
        name: 'Assembly Line 2 - Station 2 (Stiffener & Hardware)',
        code: 'ASSY-R2-S2',
        department: 'Assembly',
      },
      {
        name: 'Assembly Line 2 - Station 3 (Final Gasketing)',
        code: 'ASSY-R2-S3',
        department: 'Assembly',
      },
      {
        name: 'Assembly Line 3 - Station 1 (Perimeter Frame)',
        code: 'ASSY-R3-S1',
        department: 'Assembly',
      },
      {
        name: 'Assembly Line 3 - Station 2 (Stiffener & Hardware)',
        code: 'ASSY-R3-S2',
        department: 'Assembly',
      },
      { name: 'Quality Inspection Area', code: 'QC-01', department: 'QC' },
      {
        name: 'Palletizing & Staging Dock',
        code: 'PAL-01',
        department: 'Palletizing',
      },
      {
        name: 'Packaging & Shipping Dock',
        code: 'SHIP-01',
        department: 'Shipping',
      },
    ]

    const workstationMap: Record<string, string> = {}
    for (const s of stationConfigs) {
      let [existing] = await db
        .select()
        .from(workstations)
        .where(
          and(eq(workstations.siteId, site.id), eq(workstations.code, s.code)),
        )
        .limit(1)

      if (!existing) {
        ;[existing] = await db
          .insert(workstations)
          .values({
            siteId: site.id,
            name: s.name,
            code: s.code,
            department: s.department,
            isActive: true,
          })
          .returning()
      }
      if (existing) workstationMap[s.code] = existing.id
    }

    // 4. Ensure Operation Definitions
    const opDefs = [
      {
        code: 'OP-CNC',
        name: 'CNC Panel Routing & V-Grooving',
        department: 'CNC',
        sequence: 10,
      },
      {
        code: 'OP-ELU',
        name: 'ELU Extrusion Cutting',
        department: 'ELU',
        sequence: 20,
      },
      {
        code: 'OP-PREP',
        name: 'Parts Prep & Flange Pre-Drill',
        department: 'Parts Prep',
        sequence: 30,
      },
      {
        code: 'OP-ASSY',
        name: 'Panel Frame Assembly & Gasketing',
        department: 'Assembly',
        sequence: 40,
      },
      {
        code: 'OP-PACK',
        name: 'Final Inspection & Packaging',
        department: 'Shipping',
        sequence: 50,
      },
    ]

    const opDefMap: Record<string, string> = {}
    for (const op of opDefs) {
      let [existing] = await db
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
        ;[existing] = await db
          .insert(operationDefinitions)
          .values({
            organizationId: orgId,
            code: op.code,
            name: op.name,
            department: op.department,
            defaultSequence: op.sequence,
          })
          .returning()
      }
      if (existing) opDefMap[op.code] = existing.id
    }

    // 5. Ensure Inventory Locations
    const defaultLocations = [
      {
        code: 'BAY-A1',
        name: 'Warehouse Bay A-01 (ACM Sheets)',
        zone: 'Raw Materials',
        type: 'Storage',
      },
      {
        code: 'BAY-A2',
        name: 'Warehouse Bay A-02 (ACM Accent Sheets)',
        zone: 'Raw Materials',
        type: 'Storage',
      },
      {
        code: 'BAY-B1',
        name: 'Warehouse Bay B-01 (Specialty Cladding)',
        zone: 'Raw Materials',
        type: 'Storage',
      },
      {
        code: 'RACK-EXT-01',
        name: 'Extrusion Cantilever Rack 01',
        zone: 'Extrusions',
        type: 'Storage',
      },
      {
        code: 'BIN-HW-01',
        name: 'Hardware Bins Row 1',
        zone: 'Hardware',
        type: 'Storage',
      },
      {
        code: 'STAGE-01',
        name: 'Pallet Staging Bay 01',
        zone: 'Staging',
        type: 'Staging',
      },
      {
        code: 'SHIP-DOCK-01',
        name: 'Shipping Dock A',
        zone: 'Shipping',
        type: 'Shipping',
      },
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
      if (saved) locationMap[loc.code] = saved.id
    }

    // 6. Ensure Inventory Items & Stock Balances
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
        initialStock: '80.0000',
        locationCode: 'BAY-A1',
      },
      {
        itemNumber: 'ACM-BS-48120',
        materialFamily: 'ACM',
        description:
          '4mm ACM Panel Sheet — Bright Silver Metallic (48" × 120")',
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
        initialStock: '60.0000',
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
        initialStock: '45.0000',
        locationCode: 'BAY-A2',
      },
      {
        itemNumber: 'ACM-CB-48120',
        materialFamily: 'ACM',
        description: '4mm ACM Panel Sheet — Classic Bronze (48" × 120")',
        manufacturer: 'Alpolic Materials Inc.',
        color: 'Classic Bronze',
        finish: 'Mica PVDF',
        thickness: '0.1570',
        width: '48.0000',
        length: '120.0000',
        unit: 'sheets',
        reorderPoint: '10',
        reorderQuantity: '30',
        unitCost: '148.00',
        initialStock: '35.0000',
        locationCode: 'BAY-A2',
      },
      {
        itemNumber: 'ACM-SB-48108',
        materialFamily: 'ACM',
        description: '4mm ACM Panel Sheet — Slate Blue (48" × 108")',
        manufacturer: 'Alpolic Materials Inc.',
        color: 'Slate Blue',
        finish: 'Solid 2-Coat PVDF',
        thickness: '0.1570',
        width: '48.0000',
        length: '108.0000',
        unit: 'sheets',
        reorderPoint: '15',
        reorderQuantity: '40',
        unitCost: '152.00',
        initialStock: '30.0000',
        locationCode: 'BAY-A1',
      },
      {
        itemNumber: 'ACM-TM-60120',
        materialFamily: 'ACM',
        description: '4mm ACM Panel Sheet — Titanium Metallic (60" × 120")',
        manufacturer: 'Mitsubishi Chemical America',
        color: 'Titanium Metallic',
        finish: 'Metallic 3-Coat PVDF',
        thickness: '0.1570',
        width: '60.0000',
        length: '120.0000',
        unit: 'sheets',
        reorderPoint: '10',
        reorderQuantity: '30',
        unitCost: '185.00',
        initialStock: '25.0000',
        locationCode: 'BAY-A2',
      },
      {
        itemNumber: 'SWISS-BO-4896',
        materialFamily: 'Swisspearl',
        description:
          '8mm Swisspearl Fiber Cement Panel — Carat Black Opal (48" × 96")',
        manufacturer: 'Swisspearl North America',
        color: 'Black Opal',
        finish: 'Hydrophobic Matte',
        thickness: '0.3150',
        width: '48.0000',
        length: '96.0000',
        unit: 'sheets',
        reorderPoint: '8',
        reorderQuantity: '20',
        unitCost: '265.00',
        initialStock: '18.0000',
        locationCode: 'BAY-B1',
      },
      {
        itemNumber: 'ALU-EXT-4001',
        materialFamily: 'Extrusion',
        description: 'Perimeter Extrusion Profile 4001 (24ft Stock Length)',
        manufacturer: 'Ellwood Standard Extrusions',
        color: 'Mill Finish',
        finish: 'Mill Finish',
        thickness: '0.1250',
        width: '2.5000',
        length: '288.0000',
        unit: 'ft',
        reorderPoint: '300',
        reorderQuantity: '600',
        unitCost: '4.25',
        initialStock: '1200.0000',
        locationCode: 'RACK-EXT-01',
      },
      {
        itemNumber: 'ALU-EXT-4002',
        materialFamily: 'Extrusion',
        description: 'Intermediate Stiffener Profile 4002 (24ft Stock Length)',
        manufacturer: 'Ellwood Standard Extrusions',
        color: 'Mill Finish',
        finish: 'Mill Finish',
        thickness: '0.1250',
        width: '1.7500',
        length: '288.0000',
        unit: 'ft',
        reorderPoint: '200',
        reorderQuantity: '480',
        unitCost: '3.80',
        initialStock: '720.0000',
        locationCode: 'RACK-EXT-01',
      },
      {
        itemNumber: 'CLIP-ALU-25',
        materialFamily: 'Fastener',
        description: 'Heavy Duty Attachment Clips - 2.5" Extruded Aluminum',
        manufacturer: 'Ellwood Standard Extrusions',
        color: 'Mill Finish',
        finish: 'Mill Finish',
        thickness: '0.1250',
        width: '2.5000',
        length: '2.5000',
        unit: 'pcs',
        reorderPoint: '500',
        reorderQuantity: '2000',
        unitCost: '0.85',
        initialStock: '2500.0000',
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
        initialStock: '10000.0000',
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

        const targetLocId =
          locationMap[item.locationCode] || Object.values(locationMap)[0]
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

    // 7. Ensure Purchase Orders
    const [existingPo] = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.organizationId, orgId))
      .limit(1)

    if (!existingPo) {
      const [po1] = await db
        .insert(purchaseOrders)
        .values({
          organizationId: orgId,
          poNumber: 'PO-94101',
          vendorName: 'Mitsubishi Chemical America',
          status: 'Issued',
          orderDate: new Date(Date.now() - 86400000 * 3),
          expectedDate: new Date(Date.now() + 86400000 * 4),
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
          purchaseOrderId: po1.id,
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

    // 8. Ensure 7 Showcase Releases exist if productionJobs count === 0
    const existingJobs = await db
      .select({ id: productionJobs.id })
      .from(productionJobs)
      .where(eq(productionJobs.organizationId, orgId))
      .limit(1)

    if (existingJobs.length === 0) {
      console.log(
        'Auto-populating 7 rich showcase releases for organization:',
        orgId,
      )

      // Customers & Projects
      const customerData = [
        {
          code: 'APEX',
          name: 'Apex Facades & Glazing',
          projCode: 'TG-PH2',
          projName: 'Tempe Gateway Commercial Center Phase II',
          loc: 'Tempe, AZ',
        },
        {
          code: 'MILEHIGH',
          name: 'Mile High Cladding Partners',
          projCode: 'DH-MED',
          projName: 'Denver Health Pavilion & Medical Arts',
          loc: 'Denver, CO',
        },
        {
          code: 'FRONTRANGE',
          name: 'Front Range Architectural Fabricators',
          projCode: 'BTC-B',
          projName: 'Boulder Tech Campus Building B',
          loc: 'Boulder, CO',
        },
        {
          code: 'WASATCH',
          name: 'Wasatch Exterior Systems',
          projCode: 'SLC-CANOPY',
          projName: 'Salt Lake City Civic Center Canopy',
          loc: 'Salt Lake City, UT',
        },
        {
          code: 'SUMMIT',
          name: 'Summit Alpine Enclosures',
          projCode: 'AH-LODGE',
          projName: 'Aspen Highlands Mountain Lodge',
          loc: 'Aspen, CO',
        },
        {
          code: 'SKYLINE',
          name: 'Skyline Building Envelope Inc.',
          projCode: 'CCP-TOWER',
          projName: 'Cherry Creek Plaza Tower',
          loc: 'Denver, CO',
        },
      ]

      const customerMap: Record<string, { custId: string; projId: string }> = {}
      for (const c of customerData) {
        let [cust] = await db
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.organizationId, orgId),
              eq(customers.code, c.code),
            ),
          )
          .limit(1)

        if (!cust) {
          ;[cust] = await db
            .insert(customers)
            .values({
              organizationId: orgId,
              name: c.name,
              code: c.code,
              contactName: 'Project Representative',
              contactEmail: `contact@${c.code.toLowerCase()}.test`,
            })
            .returning()
        }

        let [proj] = await db
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.organizationId, orgId),
              eq(projects.code, c.projCode),
            ),
          )
          .limit(1)

        if (!proj) {
          ;[proj] = await db
            .insert(projects)
            .values({
              organizationId: orgId,
              customerId: cust.id,
              name: c.projName,
              code: c.projCode,
              location: c.loc,
            })
            .returning()
        }
        customerMap[c.code] = { custId: cust.id, projId: proj.id }
      }

      // --- Release 1: Job 25036 - Release 1 (Rev A) [Dispatched] ---
      const [j25036] = await db
        .insert(productionJobs)
        .values({
          organizationId: orgId,
          customerId: customerMap['APEX'].custId,
          projectId: customerMap['APEX'].projId,
          jobNumber: '25036',
          name: 'Tempe Gateway Exterior Cladding',
          status: 'Active',
        })
        .returning()

      const [r25036_1] = await db
        .insert(releases)
        .values({
          organizationId: orgId,
          jobId: j25036.id,
          releaseNumber: 1,
          status: 'In production',
          priority: 1,
          requiredDate: new Date(Date.now() - 86400000 * 2),
        })
        .returning()

      const [rev25036_1] = await db
        .insert(releaseRevisions)
        .values({
          organizationId: orgId,
          releaseId: r25036_1.id,
          revisionNumber: 1,
          revisionLabel: 'A',
          isCurrent: true,
          status: 'Approved',
          notes: 'Full controlled release package approved.',
        })
        .returning()

      const r1Marks = [
        {
          mark: 'P-101',
          count: 4,
          width: '48.00',
          height: '96.00',
          color: 'Charcoal Grey',
          type: 'ACM Field Panel',
        },
        {
          mark: 'P-102',
          count: 4,
          width: '48.00',
          height: '96.00',
          color: 'Charcoal Grey',
          type: 'ACM Field Panel',
        },
        {
          mark: 'P-103',
          count: 4,
          width: '48.00',
          height: '120.00',
          color: 'Bright Silver',
          type: 'ACM Spandrel',
        },
        {
          mark: 'P-104',
          count: 2,
          width: '48.00',
          height: '120.00',
          color: 'Bright Silver',
          type: 'ACM Parapet',
        },
        {
          mark: 'P-105',
          count: 3,
          width: '36.00',
          height: '96.00',
          color: 'Charcoal Grey',
          type: 'ACM Window Return',
        },
        {
          mark: 'P-106',
          count: 3,
          width: '36.00',
          height: '96.00',
          color: 'Charcoal Grey',
          type: 'ACM Window Return',
        },
        {
          mark: 'P-107',
          count: 2,
          width: '60.00',
          height: '120.00',
          color: 'Bone White',
          type: 'ACM Soffit',
        },
        {
          mark: 'C-201',
          count: 4,
          width: '24.00',
          height: '96.00',
          color: 'Charcoal Grey',
          type: 'ACM Corner',
        },
        {
          mark: 'S-301',
          count: 6,
          width: '30.00',
          height: '72.00',
          color: 'Classic Bronze',
          type: 'ACM Soffit',
        },
      ]

      const r1SavedMarks: Record<string, string> = {}
      for (const pm of r1Marks) {
        const [saved] = await db
          .insert(panelMarks)
          .values({
            organizationId: orgId,
            releaseRevisionId: rev25036_1.id,
            mark: pm.mark,
            description: `${pm.type} — ${pm.color} (${pm.width}" × ${pm.height}")`,
            quantity: pm.count,
            materialFamily: 'ACM',
            color: pm.color,
            thickness: '0.1575',
            width: pm.width,
            length: pm.height,
            dimensionUnit: 'in',
          })
          .returning()
        r1SavedMarks[pm.mark] = saved.id

        for (const [opCode, wsCode] of [
          ['OP-CNC', 'CNC-01'],
          ['OP-ELU', 'ELU-01'],
          ['OP-PREP', 'PREP-01'],
          ['OP-ASSY', 'ASSY-R1-S1'],
          ['OP-PACK', 'SHIP-01'],
        ]) {
          await db.insert(operationInstances).values({
            organizationId: orgId,
            releaseRevisionId: rev25036_1.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap[opCode],
            sequence:
              opCode === 'OP-CNC'
                ? 10
                : opCode === 'OP-ELU'
                  ? 20
                  : opCode === 'OP-PREP'
                    ? 30
                    : opCode === 'OP-ASSY'
                      ? 40
                      : 50,
            assignedWorkstationId: workstationMap[wsCode],
            status: 'Completed',
            plannedQuantity: pm.count,
            completedQuantity: pm.count,
          })
        }
      }

      // Pallets & Shipment for Release 1
      const [pal1] = await db
        .insert(pallets)
        .values({
          organizationId: orgId,
          palletNumber: 'PAL-25036-R1-001',
          releaseId: r25036_1.id,
          releaseRevisionId: rev25036_1.id,
          status: 'Shipped',
          elevation: 'North Elevation',
          maxWeightLbs: '2500.00',
          currentWeightLbs: '640.00',
          panelCount: 8,
        })
        .returning()

      const [pal2] = await db
        .insert(pallets)
        .values({
          organizationId: orgId,
          palletNumber: 'PAL-25036-R1-002',
          releaseId: r25036_1.id,
          releaseRevisionId: rev25036_1.id,
          status: 'Staged',
          elevation: 'East Elevation',
          maxWeightLbs: '2500.00',
          currentWeightLbs: '520.00',
          panelCount: 6,
        })
        .returning()

      await db.insert(palletItems).values([
        {
          organizationId: orgId,
          palletId: pal1.id,
          panelMarkId: r1SavedMarks['P-101'],
          quantity: 4,
        },
        {
          organizationId: orgId,
          palletId: pal1.id,
          panelMarkId: r1SavedMarks['P-102'],
          quantity: 4,
        },
        {
          organizationId: orgId,
          palletId: pal2.id,
          panelMarkId: r1SavedMarks['P-103'],
          quantity: 4,
        },
      ])

      const [shp1] = await db
        .insert(shipments)
        .values({
          organizationId: orgId,
          shipmentNumber: 'SHP-25036-001',
          carrier: 'Ellwood Dedicated Logistics',
          bolNumber: 'BOL-25036-001',
          destinationAddress:
            'Tempe Gateway Phase II, 400 E Rio Salado Pkwy, Tempe, AZ',
          status: 'Dispatched',
          totalWeightLbs: '640.00',
          totalPallets: 1,
        })
        .returning()

      await db.insert(shipmentPallets).values({
        organizationId: orgId,
        shipmentId: shp1.id,
        palletId: pal1.id,
      })

      // QC & Remake for Release 1
      await db.insert(qualityInspections).values({
        organizationId: orgId,
        releaseId: r25036_1.id,
        releaseRevisionId: rev25036_1.id,
        panelMarkId: r1SavedMarks['P-101'],
        quantity: 4,
        disposition: 'Pass',
        notes: 'Passed complete dimensional and squareness inspection.',
      })

      const [issue1] = await db
        .insert(qualityIssues)
        .values({
          organizationId: orgId,
          releaseId: r25036_1.id,
          panelMarkId: r1SavedMarks['P-103'],
          issueNumber: 'ISSUE-25036-01',
          category: 'Surface Defect',
          severity: 'Moderate',
          detectionPoint: 'CNC Routing',
          responsibleDepartment: 'CNC',
          affectedQuantity: 1,
          disposition: 'Remake',
          status: 'Closed',
          suspectedCause: 'Face scratch through protective masking film.',
        })
        .returning()

      await db.insert(panelMarkRemakes).values({
        organizationId: orgId,
        remakeType: 'RMK',
        remakeMark: 'P-103-RMK-51',
        sequenceNumber: 51,
        originalPanelMarkId: r1SavedMarks['P-103'],
        qualityIssueId: issue1.id,
        responsibleArea: 'Shop Floor',
        materialCost: '155.00',
        laborHours: '1.50',
        laborCost: '75.00',
        totalCost: '230.00',
        status: 'Completed',
      })

      // --- Release 2: Job 25036 - Release 2 (Rev B) [Palletizing] ---
      const [r25036_2] = await db
        .insert(releases)
        .values({
          organizationId: orgId,
          jobId: j25036.id,
          releaseNumber: 2,
          status: 'In production',
          priority: 2,
          requiredDate: new Date(Date.now() + 86400000 * 7),
        })
        .returning()

      const [rev25036_2] = await db
        .insert(releaseRevisions)
        .values({
          organizationId: orgId,
          releaseId: r25036_2.id,
          revisionNumber: 2,
          revisionLabel: 'B',
          isCurrent: true,
          status: 'Approved',
          notes: 'Rev B: Parapet return dimensions updated.',
        })
        .returning()

      const r2Marks = [
        {
          mark: 'P-201',
          count: 6,
          width: '48.00',
          height: '96.00',
          color: 'Charcoal Grey',
          type: 'ACM Parapet',
        },
        {
          mark: 'P-202',
          count: 4,
          width: '48.00',
          height: '120.00',
          color: 'Bright Silver',
          type: 'ACM Spandrel',
        },
        {
          mark: 'C-203',
          count: 2,
          width: '24.00',
          height: '96.00',
          color: 'Charcoal Grey',
          type: 'ACM Corner',
        },
        {
          mark: 'S-205',
          count: 4,
          width: '30.00',
          height: '72.00',
          color: 'Classic Bronze',
          type: 'ACM Soffit',
        },
      ]

      for (const pm of r2Marks) {
        const [saved] = await db
          .insert(panelMarks)
          .values({
            organizationId: orgId,
            releaseRevisionId: rev25036_2.id,
            mark: pm.mark,
            description: `${pm.type} — ${pm.color} (${pm.width}" × ${pm.height}")`,
            quantity: pm.count,
            materialFamily: 'ACM',
            color: pm.color,
            thickness: '0.1575',
            width: pm.width,
            length: pm.height,
            dimensionUnit: 'in',
          })
          .returning()

        await db.insert(operationInstances).values([
          {
            organizationId: orgId,
            releaseRevisionId: rev25036_2.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-CNC'],
            sequence: 10,
            assignedWorkstationId: workstationMap['CNC-01'],
            status: 'Completed',
            plannedQuantity: pm.count,
            completedQuantity: pm.count,
          },
          {
            organizationId: orgId,
            releaseRevisionId: rev25036_2.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-ELU'],
            sequence: 20,
            assignedWorkstationId: workstationMap['ELU-01'],
            status: 'Completed',
            plannedQuantity: pm.count,
            completedQuantity: pm.count,
          },
          {
            organizationId: orgId,
            releaseRevisionId: rev25036_2.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-PREP'],
            sequence: 30,
            assignedWorkstationId: workstationMap['PREP-01'],
            status: 'Completed',
            plannedQuantity: pm.count,
            completedQuantity: pm.count,
          },
          {
            organizationId: orgId,
            releaseRevisionId: rev25036_2.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-ASSY'],
            sequence: 40,
            assignedWorkstationId: workstationMap['ASSY-R1-S2'],
            status: 'Completed',
            plannedQuantity: pm.count,
            completedQuantity: pm.count,
          },
          {
            organizationId: orgId,
            releaseRevisionId: rev25036_2.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-PACK'],
            sequence: 50,
            assignedWorkstationId: workstationMap['SHIP-01'],
            status: 'In progress',
            plannedQuantity: pm.count,
            completedQuantity: 0,
          },
        ])
      }

      // --- Release 3: Job 25042 - Release 1 (Rev A) [Assembly & QC] ---
      const [j25042] = await db
        .insert(productionJobs)
        .values({
          organizationId: orgId,
          customerId: customerMap['MILEHIGH'].custId,
          projectId: customerMap['MILEHIGH'].projId,
          jobNumber: '25042',
          name: 'Denver Health Pavilion Cladding System',
          status: 'Active',
        })
        .returning()

      const [r25042_1] = await db
        .insert(releases)
        .values({
          organizationId: orgId,
          jobId: j25042.id,
          releaseNumber: 1,
          status: 'In production',
          priority: 1,
          requiredDate: new Date(Date.now() + 86400000 * 10),
        })
        .returning()

      const [rev25042_1] = await db
        .insert(releaseRevisions)
        .values({
          organizationId: orgId,
          releaseId: r25042_1.id,
          revisionNumber: 1,
          revisionLabel: 'A',
          isCurrent: true,
          status: 'Approved',
          notes: 'Denver Health Pavilion clinical wing entrance facade.',
        })
        .returning()

      const r3Marks = [
        {
          mark: 'DH-101',
          count: 4,
          width: '48.00',
          height: '108.00',
          color: 'Bone White',
          type: 'ACM Clinical Wall',
        },
        {
          mark: 'DH-102',
          count: 4,
          width: '48.00',
          height: '108.00',
          color: 'Slate Blue',
          type: 'ACM Accent Band',
        },
        {
          mark: 'DH-103',
          count: 4,
          width: '48.00',
          height: '96.00',
          color: 'Bone White',
          type: 'ACM Window Jamb',
        },
        {
          mark: 'DH-104',
          count: 3,
          width: '36.00',
          height: '120.00',
          color: 'Slate Blue',
          type: 'ACM Entrance Pylon',
        },
      ]

      for (const pm of r3Marks) {
        const [saved] = await db
          .insert(panelMarks)
          .values({
            organizationId: orgId,
            releaseRevisionId: rev25042_1.id,
            mark: pm.mark,
            description: `${pm.type} — ${pm.color} (${pm.width}" × ${pm.height}")`,
            quantity: pm.count,
            materialFamily: 'ACM',
            color: pm.color,
            thickness: '0.1575',
            width: pm.width,
            length: pm.height,
            dimensionUnit: 'in',
          })
          .returning()

        await db.insert(operationInstances).values([
          {
            organizationId: orgId,
            releaseRevisionId: rev25042_1.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-CNC'],
            sequence: 10,
            assignedWorkstationId: workstationMap['CNC-02'],
            status: 'Completed',
            plannedQuantity: pm.count,
            completedQuantity: pm.count,
          },
          {
            organizationId: orgId,
            releaseRevisionId: rev25042_1.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-ELU'],
            sequence: 20,
            assignedWorkstationId: workstationMap['ELU-01'],
            status: 'Completed',
            plannedQuantity: pm.count,
            completedQuantity: pm.count,
          },
          {
            organizationId: orgId,
            releaseRevisionId: rev25042_1.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-PREP'],
            sequence: 30,
            assignedWorkstationId: workstationMap['PREP-01'],
            status: 'Completed',
            plannedQuantity: pm.count,
            completedQuantity: pm.count,
          },
          {
            organizationId: orgId,
            releaseRevisionId: rev25042_1.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-ASSY'],
            sequence: 40,
            assignedWorkstationId: workstationMap['ASSY-R2-S1'],
            status: pm.mark === 'DH-101' ? 'Completed' : 'In progress',
            plannedQuantity: pm.count,
            completedQuantity: pm.mark === 'DH-101' ? pm.count : 2,
          },
          {
            organizationId: orgId,
            releaseRevisionId: rev25042_1.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-PACK'],
            sequence: 50,
            assignedWorkstationId: workstationMap['SHIP-01'],
            status: 'Pending',
            plannedQuantity: pm.count,
            completedQuantity: 0,
          },
        ])
      }

      // --- Release 4: Job 25048 - Release 1 (Rev A) [CNC & Sawing] ---
      const [j25048] = await db
        .insert(productionJobs)
        .values({
          organizationId: orgId,
          customerId: customerMap['FRONTRANGE'].custId,
          projectId: customerMap['FRONTRANGE'].projId,
          jobNumber: '25048',
          name: 'Boulder Tech Campus Building B Facade',
          status: 'Active',
        })
        .returning()

      const [r25048_1] = await db
        .insert(releases)
        .values({
          organizationId: orgId,
          jobId: j25048.id,
          releaseNumber: 1,
          status: 'In production',
          priority: 2,
          requiredDate: new Date(Date.now() + 86400000 * 18),
        })
        .returning()

      const [rev25048_1] = await db
        .insert(releaseRevisions)
        .values({
          organizationId: orgId,
          releaseId: r25048_1.id,
          revisionNumber: 1,
          revisionLabel: 'A',
          isCurrent: true,
          status: 'Approved',
          notes: 'High performance rainscreen cladding panels for Boulder lab.',
        })
        .returning()

      const r4Marks = [
        {
          mark: 'BTC-101',
          count: 6,
          width: '60.00',
          height: '120.00',
          color: 'Titanium Metallic',
          type: 'ACM High Bay',
        },
        {
          mark: 'BTC-102',
          count: 4,
          width: '48.00',
          height: '96.00',
          color: 'Anthracite Grey',
          type: 'ACM Louver',
        },
      ]

      for (const pm of r4Marks) {
        const [saved] = await db
          .insert(panelMarks)
          .values({
            organizationId: orgId,
            releaseRevisionId: rev25048_1.id,
            mark: pm.mark,
            description: `${pm.type} — ${pm.color}`,
            quantity: pm.count,
            materialFamily: 'ACM',
            color: pm.color,
            thickness: '0.1575',
            width: pm.width,
            length: pm.height,
            dimensionUnit: 'in',
          })
          .returning()

        await db.insert(operationInstances).values([
          {
            organizationId: orgId,
            releaseRevisionId: rev25048_1.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-CNC'],
            sequence: 10,
            assignedWorkstationId: workstationMap['CNC-01'],
            status: 'In progress',
            plannedQuantity: pm.count,
            completedQuantity: pm.mark === 'BTC-101' ? 3 : 0,
          },
          {
            organizationId: orgId,
            releaseRevisionId: rev25048_1.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-ELU'],
            sequence: 20,
            assignedWorkstationId: workstationMap['ELU-02'],
            status: 'In progress',
            plannedQuantity: pm.count,
            completedQuantity: 0,
          },
          {
            organizationId: orgId,
            releaseRevisionId: rev25048_1.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-PREP'],
            sequence: 30,
            assignedWorkstationId: workstationMap['PREP-01'],
            status: 'Pending',
            plannedQuantity: pm.count,
            completedQuantity: 0,
          },
          {
            organizationId: orgId,
            releaseRevisionId: rev25048_1.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-ASSY'],
            sequence: 40,
            assignedWorkstationId: workstationMap['ASSY-R2-S2'],
            status: 'Pending',
            plannedQuantity: pm.count,
            completedQuantity: 0,
          },
          {
            organizationId: orgId,
            releaseRevisionId: rev25048_1.id,
            panelMarkId: saved.id,
            operationDefinitionId: opDefMap['OP-PACK'],
            sequence: 50,
            assignedWorkstationId: workstationMap['SHIP-01'],
            status: 'Pending',
            plannedQuantity: pm.count,
            completedQuantity: 0,
          },
        ])
      }

      // --- Release 5: Job 25055 - Release 1 (Rev A) [Intake / Approved] ---
      const [j25055] = await db
        .insert(productionJobs)
        .values({
          organizationId: orgId,
          customerId: customerMap['WASATCH'].custId,
          projectId: customerMap['WASATCH'].projId,
          jobNumber: '25055',
          name: 'Salt Lake City Civic Canopy Cladding',
          status: 'Active',
        })
        .returning()

      const [r25055_1] = await db
        .insert(releases)
        .values({
          organizationId: orgId,
          jobId: j25055.id,
          releaseNumber: 1,
          status: 'Draft',
          priority: 3,
          requiredDate: new Date(Date.now() + 86400000 * 25),
        })
        .returning()

      await db.insert(releaseRevisions).values({
        organizationId: orgId,
        releaseId: r25055_1.id,
        revisionNumber: 1,
        revisionLabel: 'A',
        isCurrent: true,
        status: 'Approved',
        notes:
          'Initial engineering package release for civic center entry canopy.',
      })

      // --- Release 6: Job 25061 - Release 1 (Rev C) [Fiber Cement Rework] ---
      const [j25061] = await db
        .insert(productionJobs)
        .values({
          organizationId: orgId,
          customerId: customerMap['SUMMIT'].custId,
          projectId: customerMap['SUMMIT'].projId,
          jobNumber: '25061',
          name: 'Aspen Highlands Mountain Lodge Envelope',
          status: 'Active',
        })
        .returning()

      const [r25061_1] = await db
        .insert(releases)
        .values({
          organizationId: orgId,
          jobId: j25061.id,
          releaseNumber: 1,
          status: 'In production',
          priority: 1,
          requiredDate: new Date(Date.now() + 86400000 * 12),
        })
        .returning()

      await db.insert(releaseRevisions).values({
        organizationId: orgId,
        releaseId: r25061_1.id,
        revisionNumber: 3,
        revisionLabel: 'C',
        isCurrent: true,
        status: 'Approved',
        notes:
          'Rev C: Precision CNC diamond toolpaths for 8mm Swisspearl Carat Black Opal.',
      })

      // --- Release 7: Job 25070 - Release 1 (Rev A) [Scheduled / Allocated] ---
      const [j25070] = await db
        .insert(productionJobs)
        .values({
          organizationId: orgId,
          customerId: customerMap['SKYLINE'].custId,
          projectId: customerMap['SKYLINE'].projId,
          jobNumber: '25070',
          name: 'Cherry Creek Plaza Architectural Tower',
          status: 'Active',
        })
        .returning()

      const [r25070_1] = await db
        .insert(releases)
        .values({
          organizationId: orgId,
          jobId: j25070.id,
          releaseNumber: 1,
          status: 'In production',
          priority: 2,
          requiredDate: new Date(Date.now() + 86400000 * 30),
        })
        .returning()

      await db.insert(releaseRevisions).values({
        organizationId: orgId,
        releaseId: r25070_1.id,
        revisionNumber: 1,
        revisionLabel: 'A',
        isCurrent: true,
        status: 'Approved',
        notes: 'Plaza Tower exterior spandrels and corner reveals.',
      })

      console.log('✓ 7 showcase releases populated successfully.')
    }

    systemFoundationInitialized = true
  } catch (err) {
    console.error('ensureSystemFoundationPopulated notice:', err)
  }
}
