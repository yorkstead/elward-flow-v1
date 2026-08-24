import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { db, pool } from '@/db'
import {
  organizations,
  users,
  sites,
  workstations,
  customers,
  projects,
  productionJobs,
  releases,
  releaseRevisions,
  panelMarks,
  documentClassifications,
  documents,
  documentRevisions,
  storedFiles,
  operationDefinitions,
  operationInstances,
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
  auditEvents,
} from '@/db/schema'
import { getFileStore } from '@/lib/files/minio-file-store'
import { generateDemoReleaseFiles } from './generate-demo-release-files'

export async function seedShowcaseRelease(shouldClosePool = false) {
  console.log('=== SEEDING COMPLETE SHOWCASE ENVIRONMENT (JOB 25036) ===')

  // 1. Generate local files in fixtures/
  await generateDemoReleaseFiles()
  const fixturesDir = path.resolve(process.cwd(), 'fixtures')

  // 2. Organization & User
  let [organization] = await db.select().from(organizations).limit(1)
  if (!organization) {
    ;[organization] = await db
      .insert(organizations)
      .values({
        name: 'Elward Systems — Local Development',
        slug: 'elward-systems-local',
      })
      .returning()
  }

  let [site] = await db
    .select()
    .from(sites)
    .where(eq(sites.organizationId, organization.id))
    .limit(1)

  if (!site) {
    ;[site] = await db
      .insert(sites)
      .values({
        organizationId: organization.id,
        name: 'Main Fabrication Facility',
        code: 'MAIN-FAB',
        isProductionFacility: true,
        timezone: 'America/Denver',
      })
      .returning()
  }

  let [adminUser] = await db.select().from(users).limit(1)

  if (!adminUser) {
    ;[adminUser] = await db
      .insert(users)
      .values({
        organizationId: organization.id,
        siteId: site.id,
        name: 'Elward Systems Administrator',
        email: 'admin@example.test',
        passwordHash:
          '$2a$10$w0992P5zT.KzV59/QeFz7.XF9tYk12g17n6r97yF9g.5W7.67O4e.',
        isAdmin: true,
      })
      .returning()
  }

  // 3. Clear existing release records for clean setup
  console.log('1. Clearing old release data...')
  await db
    .delete(auditEvents)
    .where(eq(auditEvents.organizationId, organization.id))
  await db.delete(purchaseOrderLines)
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

  // 4. Ensure Workstations (17 Stations)
  console.log('2. Configuring 17 Shop-Floor Workstations...')
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
    {
      name: 'CNC Router 03 (5x10 Secondary Bed)',
      code: 'CNC-03',
      department: 'CNC',
    },
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
    {
      name: 'Assembly Line 3 - Station 3 (Final Gasketing)',
      code: 'ASSY-R3-S3',
      department: 'Assembly',
    },
    {
      name: 'Quality Inspection & Staging Area',
      code: 'QC-01',
      department: 'QC',
    },
    {
      name: 'Packaging & Shipping Dock',
      code: 'SHIP-01',
      department: 'Shipping',
    },
  ]

  const workstationMap: Record<string, string> = {}
  for (const s of stationConfigs) {
    let [saved] = await db
      .select()
      .from(workstations)
      .where(eq(workstations.code, s.code))
      .limit(1)

    if (!saved) {
      ;[saved] = await db
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
    workstationMap[s.code] = saved.id
  }

  // 5. Operation Definitions (Shop Flow: CNC -> ELU -> Prep -> Assembly -> Packaging)
  console.log('3. Ensuring Operation Definitions...')
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
    let [saved] = await db
      .select()
      .from(operationDefinitions)
      .where(eq(operationDefinitions.code, op.code))
      .limit(1)

    if (!saved) {
      ;[saved] = await db
        .insert(operationDefinitions)
        .values({
          organizationId: organization.id,
          code: op.code,
          name: op.name,
          department: op.department,
          defaultSequence: op.sequence,
        })
        .returning()
    }
    opDefMap[op.code] = saved.id
  }

  // 6. Customer, Project & Production Job 25036
  console.log('4. Creating Customer, Project & Job 25036...')
  let [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.organizationId, organization.id))
    .limit(1)
  if (!customer) {
    ;[customer] = await db
      .insert(customers)
      .values({
        organizationId: organization.id,
        name: 'Tempe Gateway Commercial Partners',
        code: 'TEMPE',
        contactName: 'Jane Doe',
        contactEmail: 'jane.doe@example.test',
        contactPhone: '555-0199',
      })
      .returning()
  }

  let [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, organization.id))
    .limit(1)
  if (!project) {
    ;[project] = await db
      .insert(projects)
      .values({
        organizationId: organization.id,
        customerId: customer.id,
        name: 'Tempe Gateway Commercial Center Phase II',
        code: 'TG-PH2',
        location: 'Tempe, AZ',
      })
      .returning()
  }

  const [job] = await db
    .insert(productionJobs)
    .values({
      organizationId: organization.id,
      customerId: customer.id,
      projectId: project.id,
      jobNumber: '25036',
      name: 'Tempe Gateway Exterior Cladding',
      status: 'Active',
    })
    .onConflictDoUpdate({
      target: [productionJobs.organizationId, productionJobs.jobNumber],
      set: {
        name: 'Tempe Gateway Exterior Cladding',
        status: 'Active',
        updatedAt: new Date(),
      },
    })
    .returning()

  // 7. Release 25036-1 & Revision A
  console.log('5. Creating Release 25036-1 (Revision A)...')
  const [release] = await db
    .insert(releases)
    .values({
      organizationId: organization.id,
      jobId: job.id,
      releaseNumber: 1,
      status: 'In production',
      priority: 1,
      requiredDate: new Date(Date.now() + 86400000 * 14), // in 2 weeks
    })
    .returning()

  const [releaseRev] = await db
    .insert(releaseRevisions)
    .values({
      organizationId: organization.id,
      releaseId: release.id,
      revisionNumber: 1,
      revisionLabel: 'A',
      isCurrent: true,
      status: 'Approved',
      approvedById: adminUser.id,
      approvedAt: new Date(Date.now() - 86400000 * 1),
      notes:
        'Approved for shop fabrication — Full set of drawings & takeoffs released',
    })
    .returning()

  // 8. Document Classifications & Controlled Documents
  console.log('6. Uploading and Linking Controlled Release Documents...')
  const docClassList = [
    {
      code: 'table_layout',
      name: 'Table Layout',
      file: '25036-R1 Table Layout Bed 1.pdf',
    },
    {
      code: 'cut_drawing',
      name: 'Cut Drawing',
      file: '25036-R1 Cut Drawings CNC.pdf',
    },
    {
      code: 'extrusion_cut_list',
      name: 'Extrusion Cut List',
      file: '25036-R1 Extrusion Cut List.pdf',
    },
    {
      code: 'assembly_drawing',
      name: 'Assembly Drawing',
      file: '25036-R1 Assembly Drawings.pdf',
    },
    {
      code: 'shop_drawing',
      name: 'Shop Drawing',
      file: '25036-R1 Shop Drawings.pdf',
    },
    {
      code: 'elevation_matrix',
      name: 'Elevation Matrix',
      file: '25036-R1 Elevation Matrix.pdf',
    },
    {
      code: 'packing_list',
      name: 'Packing List',
      file: '25036-R1 Packing List.pdf',
    },
    {
      code: 'priority_list',
      name: 'Priority List',
      file: '25036-R1 Priority Accessory List.pdf',
    },
    { code: 'takeoff', name: 'Takeoff Schedule', file: '25036_TAKEOFF_R1.csv' },
  ]

  const fileStore = getFileStore()

  for (const dc of docClassList) {
    let [classRecord] = await db
      .select()
      .from(documentClassifications)
      .where(eq(documentClassifications.code, dc.code))
      .limit(1)

    if (!classRecord) {
      ;[classRecord] = await db
        .insert(documentClassifications)
        .values({
          organizationId: organization.id,
          code: dc.code,
          name: dc.name,
          expectedByDefault: true,
        })
        .returning()
    }

    const filePath = path.join(fixturesDir, dc.file)
    if (fs.existsSync(filePath)) {
      const fileBytes = fs.readFileSync(filePath)
      const sha256 = crypto.createHash('sha256').update(fileBytes).digest('hex')
      const objectKey = `originals/releases/25036-1/rev-A/${dc.file}`

      try {
        await fileStore.putImmutable({
          key: objectKey,
          body: fileBytes,
          contentType: dc.file.endsWith('.csv')
            ? 'text/csv'
            : 'application/pdf',
        })
      } catch (storageErr) {
        console.warn(
          `Warning: Could not upload ${dc.file} to storage:`,
          storageErr,
        )
      }

      const [stored] = await db
        .insert(storedFiles)
        .values({
          organizationId: organization.id,
          objectKey,
          originalName: dc.file,
          contentType: dc.file.endsWith('.csv')
            ? 'text/csv'
            : 'application/pdf',
          byteSize: fileBytes.length,
          sha256,
          uploadedById: adminUser.id,
        })
        .onConflictDoUpdate({
          target: [storedFiles.objectKey],
          set: {
            originalName: dc.file,
            contentType: dc.file.endsWith('.csv')
              ? 'text/csv'
              : 'application/pdf',
            byteSize: fileBytes.length,
            sha256,
            updatedAt: new Date(),
          },
        })
        .returning()

      const [doc] = await db
        .insert(documents)
        .values({
          organizationId: organization.id,
          jobId: job.id,
          releaseId: release.id,
          classificationId: classRecord.id,
          name: dc.name,
          version: 1,
        })
        .returning()

      await db.insert(documentRevisions).values({
        documentId: doc.id,
        releaseRevisionId: releaseRev.id,
        storedFileId: stored.id,
        revisionLabel: 'A',
        status: 'current',
        notes: `Controlled release file for ${dc.name}`,
      })
    }
  }

  // 9. Seed 24 Panel Marks
  console.log('7. Seeding 24 Panel Marks with Geometry & Material specs...')
  const panelMarkSeed = [
    {
      mark: 'P-101',
      count: 4,
      width: '48.0000',
      height: '96.0000',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM',
      notes: 'Field panel',
    },
    {
      mark: 'P-102',
      count: 4,
      width: '48.0000',
      height: '96.0000',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM',
      notes: 'Field panel',
    },
    {
      mark: 'P-103',
      count: 4,
      width: '48.0000',
      height: '120.0000',
      color: 'Bright Silver',
      finish: 'Metallic 3-Coat PVDF',
      type: 'ACM',
      notes: 'Spandrel panel',
    },
    {
      mark: 'P-104',
      count: 2,
      width: '48.0000',
      height: '120.0000',
      color: 'Bright Silver',
      finish: 'Metallic 3-Coat PVDF',
      type: 'ACM',
      notes: 'Coping panel',
    },
    {
      mark: 'P-105',
      count: 3,
      width: '36.0000',
      height: '96.0000',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM',
      notes: 'Window return',
    },
    {
      mark: 'P-106',
      count: 3,
      width: '36.0000',
      height: '96.0000',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM',
      notes: 'Window return',
    },
    {
      mark: 'P-107',
      count: 2,
      width: '60.0000',
      height: '120.0000',
      color: 'Bone White',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM',
      notes: 'Entrance soffit',
    },
    {
      mark: 'P-108',
      count: 2,
      width: '60.0000',
      height: '120.0000',
      color: 'Bone White',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM',
      notes: 'Entrance soffit',
    },
    {
      mark: 'C-201',
      count: 4,
      width: '24.0000',
      height: '96.0000',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Corner',
      notes: 'Corner column',
    },
    {
      mark: 'C-202',
      count: 2,
      width: '24.0000',
      height: '120.0000',
      color: 'Bright Silver',
      finish: 'Metallic 3-Coat PVDF',
      type: 'ACM Corner',
      notes: 'Corner column',
    },
    {
      mark: 'S-301',
      count: 6,
      width: '30.0000',
      height: '72.0000',
      color: 'Classic Bronze',
      finish: 'Mica 2-Coat PVDF',
      type: 'ACM Soffit',
      notes: 'Canopy soffit',
    },
    {
      mark: 'S-302',
      count: 4,
      width: '30.0000',
      height: '72.0000',
      color: 'Classic Bronze',
      finish: 'Mica 2-Coat PVDF',
      type: 'ACM Soffit',
      notes: 'Canopy soffit',
    },
  ]

  const savedPanelMarks: { id: string; mark: string; count: number }[] = []
  for (const pm of panelMarkSeed) {
    const [saved] = await db
      .insert(panelMarks)
      .values({
        organizationId: organization.id,
        releaseRevisionId: releaseRev.id,
        mark: pm.mark,
        description: `${pm.type} Panel — ${pm.color} (${pm.width}" × ${pm.height}")`,
        quantity: pm.count,
        materialFamily: 'ACM',
        color: pm.color,
        thickness: '0.1575',
        width: pm.width,
        length: pm.height,
        dimensionUnit: 'in',
        notes: pm.notes,
      })
      .returning()

    savedPanelMarks.push({ id: saved.id, mark: saved.mark, count: pm.count })

    // Create Operation instances for this mark
    await db.insert(operationInstances).values([
      {
        organizationId: organization.id,
        releaseRevisionId: releaseRev.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-CNC'],
        sequence: 10,
        assignedWorkstationId: workstationMap['CNC-01'],
        status:
          pm.mark === 'P-101' || pm.mark === 'P-102'
            ? 'Completed'
            : 'In progress',
        plannedQuantity: pm.count,
        completedQuantity: pm.mark === 'P-101' ? pm.count : 0,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: releaseRev.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-ELU'],
        sequence: 20,
        assignedWorkstationId: workstationMap['ELU-01'],
        status: pm.mark === 'P-101' ? 'Completed' : 'Pending',
        plannedQuantity: pm.count,
        completedQuantity: pm.mark === 'P-101' ? pm.count : 0,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: releaseRev.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-PREP'],
        sequence: 30,
        assignedWorkstationId: workstationMap['PREP-01'],
        status: pm.mark === 'P-101' ? 'Completed' : 'Pending',
        plannedQuantity: pm.count,
        completedQuantity: pm.mark === 'P-101' ? pm.count : 0,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: releaseRev.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-ASSY'],
        sequence: 40,
        assignedWorkstationId: workstationMap['ASSY-R1-S1'],
        status: pm.mark === 'P-101' ? 'Completed' : 'Pending',
        plannedQuantity: pm.count,
        completedQuantity: pm.mark === 'P-101' ? pm.count : 0,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: releaseRev.id,
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

  // 10. Quality Inspections & Remake #51
  console.log('8. Seeding Quality Inspections & Remake RMK-51...')
  const p101Mark = savedPanelMarks.find((p) => p.mark === 'P-101')!
  const p103Mark = savedPanelMarks.find((p) => p.mark === 'P-103')!

  // Pass Inspection
  await db.insert(qualityInspections).values({
    organizationId: organization.id,
    releaseId: release.id,
    releaseRevisionId: releaseRev.id,
    panelMarkId: p101Mark.id,
    inspectorId: adminUser.id,
    quantity: 4,
    disposition: 'Pass',
    notes:
      'Perimeter tolerances and rivet spacing verified within +/- 1/32". Paint finish clean.',
    measurements: {
      width: '48.00',
      length: '96.00',
      diagonal: '107.33',
      result: 'Pass',
    },
  })

  // Issue & Remake on P-103 (Remake number 51 per constitution rule)
  const [issue] = await db
    .insert(qualityIssues)
    .values({
      organizationId: organization.id,
      releaseId: release.id,
      panelMarkId: p103Mark.id,
      issueNumber: 'ISSUE-25036-01',
      category: 'Surface Defect',
      severity: 'Moderate',
      detectionPoint: 'CNC Routing',
      responsibleDepartment: 'CNC',
      affectedQuantity: 1,
      disposition: 'Remake',
      status: 'Open',
      suspectedCause:
        'Face scratch through protective masking film on 1 unit of P-103 during table offload.',
    })
    .returning()

  await db.insert(panelMarkRemakes).values({
    organizationId: organization.id,
    remakeType: 'RMK',
    remakeMark: 'P-103-RMK-51',
    sequenceNumber: 51,
    originalPanelMarkId: p103Mark.id,
    qualityIssueId: issue.id,
    responsibleArea: 'Shop Floor',
    materialCost: '155.00',
    laborHours: '1.50',
    laborCost: '75.00',
    totalCost: '230.00',
    approvedById: adminUser.id,
    status: 'In Routing',
  })

  // 11. Pallets & Shipment
  console.log('9. Seeding Palletization and BOL Shipment...')
  const [pallet1] = await db
    .insert(pallets)
    .values({
      organizationId: organization.id,
      palletNumber: 'PAL-25036-R1-001',
      releaseId: release.id,
      releaseRevisionId: releaseRev.id,
      status: 'Staged',
      elevation: 'North Elevation',
      maxWeightLbs: '2500.00',
      currentWeightLbs: '640.00',
      panelCount: 8,
      notes: 'North elevation priority bundle (Marks P-101 & P-102)',
    })
    .returning()

  await db
    .insert(pallets)
    .values({
      organizationId: organization.id,
      palletNumber: 'PAL-25036-R1-002',
      releaseId: release.id,
      releaseRevisionId: releaseRev.id,
      status: 'Building',
      elevation: 'East Elevation',
      maxWeightLbs: '2500.00',
      currentWeightLbs: '380.00',
      panelCount: 4,
      notes: 'East elevation spandrel bundle',
    })
    .returning()

  await db.insert(palletItems).values([
    {
      organizationId: organization.id,
      palletId: pallet1.id,
      panelMarkId: p101Mark.id,
      quantity: 4,
    },
  ])

  const [shipment] = await db
    .insert(shipments)
    .values({
      organizationId: organization.id,
      shipmentNumber: 'SHP-25036-001',
      carrier: 'Elward Dedicated Flatbed',
      bolNumber: 'BOL-25036-001',
      destinationAddress:
        'Tempe Gateway Phase II, 400 E Rio Salado Pkwy, Tempe, AZ',
      status: 'Dispatched',
      totalWeightLbs: '640.00',
      totalPallets: 1,
      scheduledDeparture: new Date(Date.now() - 86400000 * 1),
      actualDeparture: new Date(Date.now() - 86400000 * 1),
      notes: 'Flatbed delivery with tarping and edge protectors.',
    })
    .returning()

  await db.insert(shipmentPallets).values({
    organizationId: organization.id,
    shipmentId: shipment.id,
    palletId: pallet1.id,
  })

  // 12. Seed Inventory Items, Lots, and Purchase Orders
  console.log(
    '10. Seeding Aligned Inventory & Purchase Orders for Job 25036...',
  )
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

  // Stock Balances
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

  // Purchase Orders
  const [po1] = await db
    .insert(purchaseOrders)
    .values({
      organizationId: organization.id,
      poNumber: 'PO-94101',
      vendorName: 'Mitsubishi Chemical America',
      status: 'Issued',
      orderDate: new Date(Date.now() - 86400000 * 2),
      expectedDate: new Date(Date.now() + 86400000 * 3),
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

  const [po2] = await db
    .insert(purchaseOrders)
    .values({
      organizationId: organization.id,
      poNumber: 'PO-94102',
      vendorName: 'Alpolic Materials Inc.',
      status: 'Partially Received',
      orderDate: new Date(Date.now() - 86400000 * 5),
      expectedDate: new Date(Date.now() + 86400000 * 1),
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

  // 13. Audit Log Events
  console.log('11. Recording Audit Trail Lineage Events...')
  await db.insert(auditEvents).values([
    {
      organizationId: organization.id,
      actorId: adminUser.id,
      actingRole: 'production_planner',
      action: 'release.intake_approved',
      resourceType: 'release',
      resourceId: release.id,
      priorState: { status: 'Draft' },
      newState: { status: 'In Production', panelCount: 38 },
      reason:
        'Approved Release 25036-1 for shop floor fabrication with full drawing set.',
    },
    {
      organizationId: organization.id,
      actorId: adminUser.id,
      actingRole: 'shop_operator',
      action: 'production.operation_completed',
      resourceType: 'operation_instance',
      resourceId: p101Mark.id,
      workstationId: workstationMap['CNC-01'],
      priorState: { status: 'in_progress' },
      newState: { status: 'completed', quantity: 4 },
      reason: 'Completed CNC Routing on Mark P-101 at workstation CNC-01.',
    },
    {
      organizationId: organization.id,
      actorId: adminUser.id,
      actingRole: 'quality_inspector',
      action: 'quality.inspection_completed',
      resourceType: 'quality_inspection',
      resourceId: p101Mark.id,
      workstationId: workstationMap['QC-01'],
      priorState: { status: 'pending' },
      newState: { result: 'Pass', quantity: 4 },
      reason: 'Passed dimensional and finish QC inspection for Mark P-101.',
    },
    {
      organizationId: organization.id,
      actorId: adminUser.id,
      actingRole: 'shipping_manager',
      action: 'pallet.staged',
      resourceType: 'pallet',
      resourceId: pallet1.id,
      priorState: { status: 'In Production' },
      newState: { status: 'Staged', location: 'STAGE-01' },
      reason: 'Staged Pallet PAL-25036-R1-001 (North Elevation) for shipment.',
    },
  ])

  console.log('=== SHOWCASE ENVIRONMENT SEEDING COMPLETE! ===')
  console.log(
    'Job 25036 Release 1 is live across all shop-floor consoles, quality, inventory, and shipping!',
  )
  if (shouldClosePool) {
    await pool.end()
  }
}

if (
  (import.meta as { main?: boolean }).main ||
  process.argv[1]?.includes('seed-showcase-release')
) {
  seedShowcaseRelease(true).catch((err) => {
    console.error('Error seeding showcase release:', err)
    process.exit(1)
  })
}
