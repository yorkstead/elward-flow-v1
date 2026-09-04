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
  roles,
  userRoles,
} from '@/db/schema'
import { getFileStore } from '@/lib/files/minio-file-store'
import { generateDemoReleaseFiles } from './generate-demo-release-files'
import { hashPassword } from '@/lib/auth/password'
import { DEMO_PERSONAS, DEMO_PASSWORD } from '@/lib/auth/demo-accounts'
import { STANDARD_ROLES } from '@/lib/services/domain'

export async function seedShowcaseRelease(shouldClosePool = false) {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_DEMO_SEED !== 'true'
  ) {
    throw new Error('Synthetic seed is not permitted in production')
  }
  try {
    await getFileStore().ensureReady()
  } catch (err: unknown) {
    console.warn(
      'File store storage check skipped/unavailable, continuing with DB seeding:',
      err instanceof Error ? err.message : String(err),
    )
  }
  console.log('=== SEEDING COMPLETE MULTI-RELEASE ENVIRONMENT (7 RELEASES) ===')

  // 1. Generate local fixture files
  await generateDemoReleaseFiles()
  const fixturesDir = path.resolve(process.cwd(), 'fixtures')

  // 2. Organization & Primary Site
  let [organization] = await db.select().from(organizations).limit(1)
  if (!organization) {
    ;[organization] = await db
      .insert(organizations)
      .values({
        name: 'Ellwood Systems — Fabrication',
        slug: 'ellwood-systems-main',
      })
      .returning()
  } else {
    await db
      .update(organizations)
      .set({
        name: 'Ellwood Systems — Fabrication',
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organization.id))
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

  // Ensure standard roles exist
  console.log('Ensuring roles exist...')
  const roleMap: Record<string, string> = {}
  for (const rName of STANDARD_ROLES) {
    const rCode = rName.toUpperCase().replace(/[\s\/\-]+/g, '_')
    const [r] = await db
      .insert(roles)
      .values({
        organizationId: organization.id,
        name: rName,
        code: rCode,
        description: `Standard role: ${rName}`,
        isSystem: true,
      })
      .onConflictDoUpdate({
        target: roles.code,
        set: { name: rName, updatedAt: new Date() },
      })
      .returning()
    roleMap[rName] = r.id
  }

  // Seed Demo Personas with known password
  console.log('Seeding demo persona accounts...')
  const demoPasswordHash = await hashPassword(DEMO_PASSWORD)

  const personaRoleAssignments: Record<string, string[]> = {
    'admin@ellwood.test': [
      'System Administrator',
      'Operations Manager',
      'Executive',
    ],
    'cnc.lead@ellwood.test': ['Shop Floor Supervisor', 'Operator'],
    'qc.lead@ellwood.test': ['Quality Inspector'],
    'shipping.lead@ellwood.test': ['Logistics Coordinator'],
  }

  for (const persona of DEMO_PERSONAS) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, persona.email))
      .limit(1)

    let userRecord = existing[0]
    if (!userRecord) {
      ;[userRecord] = await db
        .insert(users)
        .values({
          organizationId: organization.id,
          siteId: site.id,
          name: persona.name,
          email: persona.email,
          passwordHash: demoPasswordHash,
          isAdmin: persona.id === 'admin',
        })
        .returning()
    } else {
      ;[userRecord] = await db
        .update(users)
        .set({
          name: persona.name,
          passwordHash: demoPasswordHash,
          isAdmin: persona.id === 'admin',
          updatedAt: new Date(),
        })
        .where(eq(users.id, userRecord.id))
        .returning()
    }

    const assignedRoles = personaRoleAssignments[persona.email] || []
    for (const rName of assignedRoles) {
      const rId = roleMap[rName]
      if (rId) {
        await db
          .insert(userRoles)
          .values({ userId: userRecord.id, roleId: rId })
          .onConflictDoNothing()
      }
    }
  }

  const [adminUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@ellwood.test'))
    .limit(1)

  // 3. Clear existing release records for clean setup
  console.log('1. Clearing old release & production data...')
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

  // 5. Operation Definitions
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

  // 6. Document Classifications
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

  const docClassMap: Record<string, string> = {}
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
    docClassMap[dc.code] = classRecord.id
  }

  const fileStore = getFileStore()

  // 7. Customers & Projects Setup
  console.log('4. Creating 6 Customers & Projects...')
  const customerConfigs = [
    {
      name: 'Apex Facades & Glazing',
      code: 'APEX',
      contactName: 'Marcus Vance',
      contactEmail: 'm.vance@apexfacades.test',
      contactPhone: '480-555-0144',
      projectName: 'Tempe Gateway Commercial Center Phase II',
      projectCode: 'TG-PH2',
      location: 'Tempe, AZ',
    },
    {
      name: 'Mile High Cladding Partners',
      code: 'MILEHIGH',
      contactName: 'Sarah Jenkins',
      contactEmail: 's.jenkins@milehighcladding.test',
      contactPhone: '303-555-0182',
      projectName: 'Denver Health Pavilion & Medical Arts',
      projectCode: 'DH-MED',
      location: 'Denver, CO',
    },
    {
      name: 'Front Range Architectural Fabricators',
      code: 'FRONTRANGE',
      contactName: 'David Chen',
      contactEmail: 'dchen@frontrange.test',
      contactPhone: '720-555-0199',
      projectName: 'Boulder Tech Campus Building B',
      projectCode: 'BTC-B',
      location: 'Boulder, CO',
    },
    {
      name: 'Wasatch Exterior Systems',
      code: 'WASATCH',
      contactName: 'Elena Rostova',
      contactEmail: 'erostova@wasatchexteriors.test',
      contactPhone: '801-555-0163',
      projectName: 'Salt Lake City Civic Center Canopy',
      projectCode: 'SLC-CANOPY',
      location: 'Salt Lake City, UT',
    },
    {
      name: 'Summit Alpine Enclosures',
      code: 'SUMMIT',
      contactName: 'Kurt Holtzmann',
      contactEmail: 'kurt@summitalpine.test',
      contactPhone: '970-555-0112',
      projectName: 'Aspen Highlands Mountain Lodge',
      projectCode: 'AH-LODGE',
      location: 'Aspen, CO',
    },
    {
      name: 'Skyline Building Envelope Inc.',
      code: 'SKYLINE',
      contactName: 'Rachel Ross',
      contactEmail: 'rachel@skylineenvelope.test',
      contactPhone: '303-555-0177',
      projectName: 'Cherry Creek Plaza Tower',
      projectCode: 'CCP-TOWER',
      location: 'Denver, CO',
    },
  ]

  const customerMap: Record<string, { customerId: string; projectId: string }> =
    {}

  for (const c of customerConfigs) {
    let [cust] = await db
      .select()
      .from(customers)
      .where(eq(customers.code, c.code))
      .limit(1)

    if (!cust) {
      ;[cust] = await db
        .insert(customers)
        .values({
          organizationId: organization.id,
          name: c.name,
          code: c.code,
          contactName: c.contactName,
          contactEmail: c.contactEmail,
          contactPhone: c.contactPhone,
        })
        .returning()
    }

    let [proj] = await db
      .select()
      .from(projects)
      .where(eq(projects.code, c.projectCode))
      .limit(1)

    if (!proj) {
      ;[proj] = await db
        .insert(projects)
        .values({
          organizationId: organization.id,
          customerId: cust.id,
          name: c.projectName,
          code: c.projectCode,
          location: c.location,
        })
        .returning()
    }

    customerMap[c.code] = { customerId: cust.id, projectId: proj.id }
  }

  // Helper for uploading release files
  async function attachReleaseDocuments(
    jobId: string,
    releaseId: string,
    releaseRevId: string,
    jobPrefix: string,
    revLabel: string,
  ) {
    for (const dc of docClassList) {
      const filePath = path.join(fixturesDir, dc.file)
      let fileBytes: Buffer
      if (fs.existsSync(filePath)) {
        try {
          fileBytes = fs.readFileSync(filePath)
        } catch {
          fileBytes = Buffer.from(`Sample controlled document for ${dc.name}`)
        }
      } else {
        fileBytes = Buffer.from(`Sample controlled document for ${dc.name}`)
      }

      const sha256 = crypto.createHash('sha256').update(fileBytes).digest('hex')
      const objectKey = `originals/${organization.id}/synthetic/releases/${jobPrefix}/rev-${revLabel}/${sha256}/${dc.file}`

      try {
        await fileStore.putImmutable({
          key: objectKey,
          body: fileBytes,
          contentType: dc.file.endsWith('.csv')
            ? 'text/csv'
            : 'application/pdf',
        })
      } catch {
        // Continue if S3 bucket is not reachable during initial DB setup
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
          set: { originalName: dc.file, updatedAt: new Date() },
        })
        .returning()

      const [doc] = await db
        .insert(documents)
        .values({
          organizationId: organization.id,
          jobId,
          releaseId,
          classificationId: docClassMap[dc.code],
          name: dc.name,
          version: 1,
        })
        .returning()

      await db.insert(documentRevisions).values({
        documentId: doc.id,
        releaseRevisionId: releaseRevId,
        storedFileId: stored.id,
        revisionLabel: revLabel,
        status: 'current',
        notes: `Controlled release file for ${dc.name}`,
      })
    }
  }

  // =========================================================================
  // 8. SEED RELEASE 1: JOB 25036 - RELEASE 1 (REV A) [STATUS: DISPATCHED / SHIPPED]
  // =========================================================================
  console.log(
    '5. Seeding Release 1: Job 25036 - Release 1 (Dispatched / Complete)...',
  )
  const [job25036] = await db
    .insert(productionJobs)
    .values({
      organizationId: organization.id,
      customerId: customerMap['APEX'].customerId,
      projectId: customerMap['APEX'].projectId,
      jobNumber: '25036',
      name: 'Tempe Gateway Exterior Cladding',
      status: 'Active',
    })
    .returning()

  const [rel25036_1] = await db
    .insert(releases)
    .values({
      organizationId: organization.id,
      jobId: job25036.id,
      releaseNumber: 1,
      status: 'In production',
      priority: 1,
      requiredDate: new Date(Date.now() - 86400000 * 2),
    })
    .returning()

  const [relRev25036_1] = await db
    .insert(releaseRevisions)
    .values({
      organizationId: organization.id,
      releaseId: rel25036_1.id,
      revisionNumber: 1,
      revisionLabel: 'A',
      isCurrent: true,
      status: 'Approved',
      approvedById: adminUser.id,
      approvedAt: new Date(Date.now() - 86400000 * 10),
      notes:
        'Approved for shop fabrication — Full set of drawings & takeoffs released',
    })
    .returning()

  await attachReleaseDocuments(
    job25036.id,
    rel25036_1.id,
    relRev25036_1.id,
    '25036-1',
    'A',
  )

  const r1PanelData = [
    {
      mark: 'P-101',
      count: 4,
      width: '48.00',
      height: '96.00',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Field Panel',
    },
    {
      mark: 'P-102',
      count: 4,
      width: '48.00',
      height: '96.00',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Field Panel',
    },
    {
      mark: 'P-103',
      count: 4,
      width: '48.00',
      height: '120.00',
      color: 'Bright Silver',
      finish: 'Metallic 3-Coat PVDF',
      type: 'ACM Spandrel',
    },
    {
      mark: 'P-104',
      count: 2,
      width: '48.00',
      height: '120.00',
      color: 'Bright Silver',
      finish: 'Metallic 3-Coat PVDF',
      type: 'ACM Parapet',
    },
    {
      mark: 'P-105',
      count: 3,
      width: '36.00',
      height: '96.00',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Window Return',
    },
    {
      mark: 'P-106',
      count: 3,
      width: '36.00',
      height: '96.00',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Window Return',
    },
    {
      mark: 'P-107',
      count: 2,
      width: '60.00',
      height: '120.00',
      color: 'Bone White',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Soffit',
    },
    {
      mark: 'P-108',
      count: 2,
      width: '60.00',
      height: '120.00',
      color: 'Bone White',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Soffit',
    },
    {
      mark: 'C-201',
      count: 4,
      width: '24.00',
      height: '96.00',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Corner',
    },
    {
      mark: 'C-202',
      count: 2,
      width: '24.00',
      height: '120.00',
      color: 'Bright Silver',
      finish: 'Metallic 3-Coat PVDF',
      type: 'ACM Corner',
    },
    {
      mark: 'S-301',
      count: 6,
      width: '30.00',
      height: '72.00',
      color: 'Classic Bronze',
      finish: 'Mica 2-Coat PVDF',
      type: 'ACM Soffit',
    },
    {
      mark: 'S-302',
      count: 4,
      width: '30.00',
      height: '72.00',
      color: 'Classic Bronze',
      finish: 'Mica 2-Coat PVDF',
      type: 'ACM Soffit',
    },
  ]

  const r1PanelMap: Record<string, string> = {}
  for (const pm of r1PanelData) {
    const [saved] = await db
      .insert(panelMarks)
      .values({
        organizationId: organization.id,
        releaseRevisionId: relRev25036_1.id,
        mark: pm.mark,
        description: `${pm.type} — ${pm.color} (${pm.width}" × ${pm.height}")`,
        quantity: pm.count,
        materialFamily: 'ACM',
        color: pm.color,
        thickness: '0.1575',
        width: pm.width,
        length: pm.height,
        dimensionUnit: 'in',
        notes: pm.type,
      })
      .returning()
    r1PanelMap[pm.mark] = saved.id

    // Complete all operations for Release 1
    for (const [opCode, wsCode] of [
      ['OP-CNC', 'CNC-01'],
      ['OP-ELU', 'ELU-01'],
      ['OP-PREP', 'PREP-01'],
      ['OP-ASSY', 'ASSY-R1-S1'],
      ['OP-PACK', 'SHIP-01'],
    ]) {
      await db.insert(operationInstances).values({
        organizationId: organization.id,
        releaseRevisionId: relRev25036_1.id,
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

  // QC & Remake for Release 1
  await db.insert(qualityInspections).values({
    organizationId: organization.id,
    releaseId: rel25036_1.id,
    releaseRevisionId: relRev25036_1.id,
    panelMarkId: r1PanelMap['P-101'],
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

  const [issue25036] = await db
    .insert(qualityIssues)
    .values({
      organizationId: organization.id,
      releaseId: rel25036_1.id,
      panelMarkId: r1PanelMap['P-103'],
      issueNumber: 'ISSUE-25036-01',
      category: 'Surface Defect',
      severity: 'Moderate',
      detectionPoint: 'CNC Routing',
      responsibleDepartment: 'CNC',
      affectedQuantity: 1,
      disposition: 'Remake',
      status: 'Closed',
      suspectedCause:
        'Face scratch through protective film on 1 unit of P-103 during table offload.',
    })
    .returning()

  await db.insert(panelMarkRemakes).values({
    organizationId: organization.id,
    remakeType: 'RMK',
    remakeMark: 'P-103-RMK-51',
    sequenceNumber: 51,
    originalPanelMarkId: r1PanelMap['P-103'],
    qualityIssueId: issue25036.id,
    responsibleArea: 'Shop Floor',
    materialCost: '155.00',
    laborHours: '1.50',
    laborCost: '75.00',
    totalCost: '230.00',
    approvedById: adminUser.id,
    status: 'Completed',
  })

  // Pallets & Shipments for Release 1
  const [pal25036_1] = await db
    .insert(pallets)
    .values({
      organizationId: organization.id,
      palletNumber: 'PAL-25036-R1-001',
      releaseId: rel25036_1.id,
      releaseRevisionId: relRev25036_1.id,
      status: 'Shipped',
      elevation: 'North Elevation',
      maxWeightLbs: '2500.00',
      currentWeightLbs: '640.00',
      panelCount: 8,
      notes: 'North elevation priority bundle (Marks P-101 & P-102)',
    })
    .returning()

  const [pal25036_2] = await db
    .insert(pallets)
    .values({
      organizationId: organization.id,
      palletNumber: 'PAL-25036-R1-002',
      releaseId: rel25036_1.id,
      releaseRevisionId: relRev25036_1.id,
      status: 'Staged',
      elevation: 'East Elevation',
      maxWeightLbs: '2500.00',
      currentWeightLbs: '720.00',
      panelCount: 7,
      notes: 'East elevation spandrel bundle (Marks P-103, P-104, P-105)',
    })
    .returning()

  await db.insert(palletItems).values([
    {
      organizationId: organization.id,
      palletId: pal25036_1.id,
      panelMarkId: r1PanelMap['P-101'],
      quantity: 4,
    },
    {
      organizationId: organization.id,
      palletId: pal25036_1.id,
      panelMarkId: r1PanelMap['P-102'],
      quantity: 4,
    },
    {
      organizationId: organization.id,
      palletId: pal25036_2.id,
      panelMarkId: r1PanelMap['P-103'],
      quantity: 4,
    },
    {
      organizationId: organization.id,
      palletId: pal25036_2.id,
      panelMarkId: r1PanelMap['P-104'],
      quantity: 2,
    },
  ])

  const [ship25036] = await db
    .insert(shipments)
    .values({
      organizationId: organization.id,
      shipmentNumber: 'SHP-25036-001',
      carrier: 'Ellwood Dedicated Logistics (53ft Flatbed)',
      bolNumber: 'BOL-25036-001',
      destinationAddress:
        'Tempe Gateway Phase II, 400 E Rio Salado Pkwy, Tempe, AZ',
      status: 'Dispatched',
      totalWeightLbs: '640.00',
      totalPallets: 1,
      scheduledDeparture: new Date(Date.now() - 86400000 * 1),
      actualDeparture: new Date(Date.now() - 86400000 * 1),
      notes: 'Flatbed delivery with full tarping and corner edge protectors.',
    })
    .returning()

  await db.insert(shipmentPallets).values({
    organizationId: organization.id,
    shipmentId: ship25036.id,
    palletId: pal25036_1.id,
  })

  // =========================================================================
  // 9. SEED RELEASE 2: JOB 25036 - RELEASE 2 (REV B) [STATUS: PALLETIZING / STAGED]
  // =========================================================================
  console.log(
    '6. Seeding Release 2: Job 25036 - Release 2 (Palletizing Stage)...',
  )
  const [rel25036_2] = await db
    .insert(releases)
    .values({
      organizationId: organization.id,
      jobId: job25036.id,
      releaseNumber: 2,
      status: 'In production',
      priority: 2,
      requiredDate: new Date(Date.now() + 86400000 * 7),
    })
    .returning()

  // Rev A superseded, Rev B current
  await db.insert(releaseRevisions).values({
    organizationId: organization.id,
    releaseId: rel25036_2.id,
    revisionNumber: 1,
    revisionLabel: 'A',
    isCurrent: false,
    status: 'Superseded',
    approvedById: adminUser.id,
    notes: 'Superseded by Rev B for parapet miter extension updates.',
  })

  const [relRev25036_2] = await db
    .insert(releaseRevisions)
    .values({
      organizationId: organization.id,
      releaseId: rel25036_2.id,
      revisionNumber: 2,
      revisionLabel: 'B',
      isCurrent: true,
      status: 'Approved',
      approvedById: adminUser.id,
      approvedAt: new Date(Date.now() - 86400000 * 4),
      notes: 'Rev B: Parapet return dimensions updated with structural clips.',
    })
    .returning()

  const r2PanelData = [
    {
      mark: 'P-201',
      count: 6,
      width: '48.00',
      height: '96.00',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Parapet Panel',
    },
    {
      mark: 'P-202',
      count: 4,
      width: '48.00',
      height: '120.00',
      color: 'Bright Silver',
      finish: 'Metallic 3-Coat PVDF',
      type: 'ACM Crown Spandrel',
    },
    {
      mark: 'P-203',
      count: 4,
      width: '36.00',
      height: '96.00',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Louver Screen',
    },
    {
      mark: 'C-203',
      count: 2,
      width: '24.00',
      height: '96.00',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Crown Corner',
    },
    {
      mark: 'S-205',
      count: 4,
      width: '30.00',
      height: '72.00',
      color: 'Classic Bronze',
      finish: 'Mica 2-Coat PVDF',
      type: 'ACM Soffit Accent',
    },
  ]

  const r2PanelMap: Record<string, string> = {}
  for (const pm of r2PanelData) {
    const [saved] = await db
      .insert(panelMarks)
      .values({
        organizationId: organization.id,
        releaseRevisionId: relRev25036_2.id,
        mark: pm.mark,
        description: `${pm.type} — ${pm.color} (${pm.width}" × ${pm.height}")`,
        quantity: pm.count,
        materialFamily: 'ACM',
        color: pm.color,
        thickness: '0.1575',
        width: pm.width,
        length: pm.height,
        dimensionUnit: 'in',
        notes: pm.type,
      })
      .returning()
    r2PanelMap[pm.mark] = saved.id

    // Ops: Routing, Sawing, Assembly complete, Packaging in progress
    await db.insert(operationInstances).values([
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25036_2.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-CNC'],
        sequence: 10,
        assignedWorkstationId: workstationMap['CNC-01'],
        status: 'Completed',
        plannedQuantity: pm.count,
        completedQuantity: pm.count,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25036_2.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-ELU'],
        sequence: 20,
        assignedWorkstationId: workstationMap['ELU-01'],
        status: 'Completed',
        plannedQuantity: pm.count,
        completedQuantity: pm.count,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25036_2.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-PREP'],
        sequence: 30,
        assignedWorkstationId: workstationMap['PREP-01'],
        status: 'Completed',
        plannedQuantity: pm.count,
        completedQuantity: pm.count,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25036_2.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-ASSY'],
        sequence: 40,
        assignedWorkstationId: workstationMap['ASSY-R1-S2'],
        status: 'Completed',
        plannedQuantity: pm.count,
        completedQuantity: pm.count,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25036_2.id,
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

  // Pallets for Release 2
  const [pal25036_r2_1] = await db
    .insert(pallets)
    .values({
      organizationId: organization.id,
      palletNumber: 'PAL-25036-R2-001',
      releaseId: rel25036_2.id,
      releaseRevisionId: relRev25036_2.id,
      status: 'Building',
      elevation: 'South Parapet',
      maxWeightLbs: '2500.00',
      currentWeightLbs: '580.00',
      panelCount: 10,
      notes: 'South Parapet crown assembly bundle (Marks P-201 & P-203)',
    })
    .returning()

  await db.insert(palletItems).values([
    {
      organizationId: organization.id,
      palletId: pal25036_r2_1.id,
      panelMarkId: r2PanelMap['P-201'],
      quantity: 6,
    },
    {
      organizationId: organization.id,
      palletId: pal25036_r2_1.id,
      panelMarkId: r2PanelMap['P-203'],
      quantity: 4,
    },
  ])

  // =========================================================================
  // 10. SEED RELEASE 3: JOB 25042 - RELEASE 1 (REV A) [STATUS: ASSEMBLY & QC]
  // =========================================================================
  console.log(
    '7. Seeding Release 3: Job 25042 - Release 1 (Assembly & QC Stage)...',
  )
  const [job25042] = await db
    .insert(productionJobs)
    .values({
      organizationId: organization.id,
      customerId: customerMap['MILEHIGH'].customerId,
      projectId: customerMap['MILEHIGH'].projectId,
      jobNumber: '25042',
      name: 'Denver Health Pavilion Cladding System',
      status: 'Active',
    })
    .returning()

  const [rel25042_1] = await db
    .insert(releases)
    .values({
      organizationId: organization.id,
      jobId: job25042.id,
      releaseNumber: 1,
      status: 'In production',
      priority: 1,
      requiredDate: new Date(Date.now() + 86400000 * 10),
    })
    .returning()

  const [relRev25042_1] = await db
    .insert(releaseRevisions)
    .values({
      organizationId: organization.id,
      releaseId: rel25042_1.id,
      revisionNumber: 1,
      revisionLabel: 'A',
      isCurrent: true,
      status: 'Approved',
      approvedById: adminUser.id,
      approvedAt: new Date(Date.now() - 86400000 * 3),
      notes: 'Denver Health Pavilion Phase 1 clinical wing entrance facade.',
    })
    .returning()

  const r3PanelData = [
    {
      mark: 'DH-101',
      count: 4,
      width: '48.00',
      height: '108.00',
      color: 'Bone White',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Clinical Wall',
    },
    {
      mark: 'DH-102',
      count: 4,
      width: '48.00',
      height: '108.00',
      color: 'Slate Blue',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Accent Band',
    },
    {
      mark: 'DH-103',
      count: 4,
      width: '48.00',
      height: '96.00',
      color: 'Bone White',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Window Jamb',
    },
    {
      mark: 'DH-104',
      count: 3,
      width: '36.00',
      height: '120.00',
      color: 'Slate Blue',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Entrance Pylon',
    },
    {
      mark: 'DH-105',
      count: 4,
      width: '48.00',
      height: '96.00',
      color: 'Bone White',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Soffit Infill',
    },
    {
      mark: 'DHC-01',
      count: 4,
      width: '24.00',
      height: '108.00',
      color: 'Slate Blue',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Corner Column',
    },
    {
      mark: 'DHS-01',
      count: 6,
      width: '30.00',
      height: '84.00',
      color: 'Bone White',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Canopy Soffit',
    },
  ]

  const r3PanelMap: Record<string, string> = {}
  for (const pm of r3PanelData) {
    const [saved] = await db
      .insert(panelMarks)
      .values({
        organizationId: organization.id,
        releaseRevisionId: relRev25042_1.id,
        mark: pm.mark,
        description: `${pm.type} — ${pm.color} (${pm.width}" × ${pm.height}")`,
        quantity: pm.count,
        materialFamily: 'ACM',
        color: pm.color,
        thickness: '0.1575',
        width: pm.width,
        length: pm.height,
        dimensionUnit: 'in',
        notes: pm.type,
      })
      .returning()
    r3PanelMap[pm.mark] = saved.id

    // Ops: CNC & ELU complete; Assembly active
    await db.insert(operationInstances).values([
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25042_1.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-CNC'],
        sequence: 10,
        assignedWorkstationId: workstationMap['CNC-02'],
        status: 'Completed',
        plannedQuantity: pm.count,
        completedQuantity: pm.count,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25042_1.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-ELU'],
        sequence: 20,
        assignedWorkstationId: workstationMap['ELU-01'],
        status: 'Completed',
        plannedQuantity: pm.count,
        completedQuantity: pm.count,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25042_1.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-PREP'],
        sequence: 30,
        assignedWorkstationId: workstationMap['PREP-01'],
        status: 'Completed',
        plannedQuantity: pm.count,
        completedQuantity: pm.count,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25042_1.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-ASSY'],
        sequence: 40,
        assignedWorkstationId: workstationMap['ASSY-R2-S1'],
        status: pm.mark === 'DH-101' ? 'Completed' : 'In progress',
        plannedQuantity: pm.count,
        completedQuantity: pm.mark === 'DH-101' ? pm.count : 2,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25042_1.id,
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

  // QC Pass + Remake #52 for Job 25042
  await db.insert(qualityInspections).values({
    organizationId: organization.id,
    releaseId: rel25042_1.id,
    releaseRevisionId: relRev25042_1.id,
    panelMarkId: r3PanelMap['DH-101'],
    inspectorId: adminUser.id,
    quantity: 4,
    disposition: 'Pass',
    notes:
      'Bone White finish and perimeter hat-channels meet ASTM E283 air/water penetration specs.',
  })

  const [issue25042] = await db
    .insert(qualityIssues)
    .values({
      organizationId: organization.id,
      releaseId: rel25042_1.id,
      panelMarkId: r3PanelMap['DH-104'],
      issueNumber: 'ISSUE-25042-01',
      category: 'Dimensional Variance',
      severity: 'Major',
      detectionPoint: 'Assembly',
      responsibleDepartment: 'Assembly',
      affectedQuantity: 1,
      disposition: 'Remake',
      status: 'Open',
      suspectedCause:
        'Return flange bend radius over-tightened on station brake causing micro-fracture.',
    })
    .returning()

  await db.insert(panelMarkRemakes).values({
    organizationId: organization.id,
    remakeType: 'RMK',
    remakeMark: 'DH-104-RMK-52',
    sequenceNumber: 52,
    originalPanelMarkId: r3PanelMap['DH-104'],
    qualityIssueId: issue25042.id,
    responsibleArea: 'Shop Floor',
    materialCost: '185.00',
    laborHours: '2.00',
    laborCost: '100.00',
    totalCost: '285.00',
    approvedById: adminUser.id,
    status: 'In Routing',
  })

  // =========================================================================
  // 11. SEED RELEASE 4: JOB 25048 - RELEASE 1 (REV A) [STATUS: CNC & ELU CUTTING]
  // =========================================================================
  console.log(
    '8. Seeding Release 4: Job 25048 - Release 1 (CNC & Sawing Stage)...',
  )
  const [job25048] = await db
    .insert(productionJobs)
    .values({
      organizationId: organization.id,
      customerId: customerMap['FRONTRANGE'].customerId,
      projectId: customerMap['FRONTRANGE'].projectId,
      jobNumber: '25048',
      name: 'Boulder Tech Campus Building B Facade',
      status: 'Active',
    })
    .returning()

  const [rel25048_1] = await db
    .insert(releases)
    .values({
      organizationId: organization.id,
      jobId: job25048.id,
      releaseNumber: 1,
      status: 'In production',
      priority: 2,
      requiredDate: new Date(Date.now() + 86400000 * 18),
    })
    .returning()

  const [relRev25048_1] = await db
    .insert(releaseRevisions)
    .values({
      organizationId: organization.id,
      releaseId: rel25048_1.id,
      revisionNumber: 1,
      revisionLabel: 'A',
      isCurrent: true,
      status: 'Approved',
      approvedById: adminUser.id,
      approvedAt: new Date(Date.now() - 86400000 * 2),
      notes:
        'High performance rainscreen cladding panels for Boulder laboratory wing.',
    })
    .returning()

  const r4PanelData = [
    {
      mark: 'BTC-101',
      count: 6,
      width: '60.00',
      height: '120.00',
      color: 'Titanium Metallic',
      finish: 'Metallic 3-Coat PVDF',
      type: 'ACM High Bay Cladding',
    },
    {
      mark: 'BTC-102',
      count: 6,
      width: '60.00',
      height: '120.00',
      color: 'Titanium Metallic',
      finish: 'Metallic 3-Coat PVDF',
      type: 'ACM High Bay Cladding',
    },
    {
      mark: 'BTC-103',
      count: 4,
      width: '48.00',
      height: '96.00',
      color: 'Anthracite Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Louver Cladding',
    },
    {
      mark: 'BTC-104',
      count: 4,
      width: '48.00',
      height: '96.00',
      color: 'Anthracite Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Louver Cladding',
    },
    {
      mark: 'BTC-201',
      count: 4,
      width: '30.00',
      height: '120.00',
      color: 'Titanium Metallic',
      finish: 'Metallic 3-Coat PVDF',
      type: 'ACM Corner Column',
    },
    {
      mark: 'BTC-301',
      count: 4,
      width: '36.00',
      height: '72.00',
      color: 'Anthracite Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Penthouse Screen',
    },
  ]

  for (const pm of r4PanelData) {
    const [saved] = await db
      .insert(panelMarks)
      .values({
        organizationId: organization.id,
        releaseRevisionId: relRev25048_1.id,
        mark: pm.mark,
        description: `${pm.type} — ${pm.color} (${pm.width}" × ${pm.height}")`,
        quantity: pm.count,
        materialFamily: 'ACM',
        color: pm.color,
        thickness: '0.1575',
        width: pm.width,
        length: pm.height,
        dimensionUnit: 'in',
        notes: pm.type,
      })
      .returning()

    // CNC & ELU active
    await db.insert(operationInstances).values([
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25048_1.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-CNC'],
        sequence: 10,
        assignedWorkstationId: workstationMap['CNC-01'],
        status: 'In progress',
        plannedQuantity: pm.count,
        completedQuantity: pm.mark === 'BTC-101' ? 4 : 0,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25048_1.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-ELU'],
        sequence: 20,
        assignedWorkstationId: workstationMap['ELU-02'],
        status: 'In progress',
        plannedQuantity: pm.count,
        completedQuantity: 0,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25048_1.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-PREP'],
        sequence: 30,
        assignedWorkstationId: workstationMap['PREP-01'],
        status: 'Pending',
        plannedQuantity: pm.count,
        completedQuantity: 0,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25048_1.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-ASSY'],
        sequence: 40,
        assignedWorkstationId: workstationMap['ASSY-R2-S2'],
        status: 'Pending',
        plannedQuantity: pm.count,
        completedQuantity: 0,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25048_1.id,
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

  // =========================================================================
  // 12. SEED RELEASE 5: JOB 25055 - RELEASE 1 (REV A) [STATUS: APPROVED / INTAKE]
  // =========================================================================
  console.log(
    '9. Seeding Release 5: Job 25055 - Release 1 (Approved Intake Stage)...',
  )
  const [job25055] = await db
    .insert(productionJobs)
    .values({
      organizationId: organization.id,
      customerId: customerMap['WASATCH'].customerId,
      projectId: customerMap['WASATCH'].projectId,
      jobNumber: '25055',
      name: 'Salt Lake City Civic Canopy Cladding',
      status: 'Active',
    })
    .returning()

  const [rel25055_1] = await db
    .insert(releases)
    .values({
      organizationId: organization.id,
      jobId: job25055.id,
      releaseNumber: 1,
      status: 'Draft',
      priority: 3,
      requiredDate: new Date(Date.now() + 86400000 * 25),
    })
    .returning()

  const [relRev25055_1] = await db
    .insert(releaseRevisions)
    .values({
      organizationId: organization.id,
      releaseId: rel25055_1.id,
      revisionNumber: 1,
      revisionLabel: 'A',
      isCurrent: true,
      status: 'Approved',
      approvedById: adminUser.id,
      approvedAt: new Date(Date.now() - 86400000 * 1),
      notes:
        'Initial engineering package release for civic center entry canopy.',
    })
    .returning()

  const r5PanelData = [
    {
      mark: 'SLC-C01',
      count: 4,
      width: '48.00',
      height: '120.00',
      color: 'Classic Bronze',
      finish: 'Mica 2-Coat PVDF',
      type: 'ACM Bullnose Canopy',
    },
    {
      mark: 'SLC-C02',
      count: 4,
      width: '48.00',
      height: '120.00',
      color: 'Classic Bronze',
      finish: 'Mica 2-Coat PVDF',
      type: 'ACM Bullnose Canopy',
    },
    {
      mark: 'SLC-C03',
      count: 6,
      width: '36.00',
      height: '96.00',
      color: 'Gold Mica',
      finish: 'Mica 3-Coat PVDF',
      type: 'ACM Soffit Rainscreen',
    },
    {
      mark: 'SLC-C04',
      count: 6,
      width: '36.00',
      height: '96.00',
      color: 'Gold Mica',
      finish: 'Mica 3-Coat PVDF',
      type: 'ACM Soffit Rainscreen',
    },
  ]

  for (const pm of r5PanelData) {
    const [saved] = await db
      .insert(panelMarks)
      .values({
        organizationId: organization.id,
        releaseRevisionId: relRev25055_1.id,
        mark: pm.mark,
        description: `${pm.type} — ${pm.color} (${pm.width}" × ${pm.height}")`,
        quantity: pm.count,
        materialFamily: 'ACM',
        color: pm.color,
        thickness: '0.1575',
        width: pm.width,
        length: pm.height,
        dimensionUnit: 'in',
        notes: pm.type,
      })
      .returning()

    for (const [opCode, wsCode] of [
      ['OP-CNC', 'CNC-03'],
      ['OP-ELU', 'ELU-01'],
      ['OP-PREP', 'PREP-01'],
      ['OP-ASSY', 'ASSY-R3-S1'],
      ['OP-PACK', 'SHIP-01'],
    ]) {
      await db.insert(operationInstances).values({
        organizationId: organization.id,
        releaseRevisionId: relRev25055_1.id,
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
        status: 'Pending',
        plannedQuantity: pm.count,
        completedQuantity: 0,
      })
    }
  }

  // =========================================================================
  // 13. SEED RELEASE 6: JOB 25061 - RELEASE 1 (REV C) [STATUS: FIBER CEMENT & REWORK]
  // =========================================================================
  console.log(
    '10. Seeding Release 6: Job 25061 - Release 1 (Fiber Cement & Rework Stage)...',
  )
  const [job25061] = await db
    .insert(productionJobs)
    .values({
      organizationId: organization.id,
      customerId: customerMap['SUMMIT'].customerId,
      projectId: customerMap['SUMMIT'].projectId,
      jobNumber: '25061',
      name: 'Aspen Highlands Mountain Lodge Envelope',
      status: 'Active',
    })
    .returning()

  const [rel25061_1] = await db
    .insert(releases)
    .values({
      organizationId: organization.id,
      jobId: job25061.id,
      releaseNumber: 1,
      status: 'In production',
      priority: 1,
      requiredDate: new Date(Date.now() + 86400000 * 12),
    })
    .returning()

  // Rev A & B superseded
  await db.insert(releaseRevisions).values([
    {
      organizationId: organization.id,
      releaseId: rel25061_1.id,
      revisionNumber: 1,
      revisionLabel: 'A',
      isCurrent: false,
      status: 'Superseded',
      approvedById: adminUser.id,
      notes: 'Superseded by Rev B',
    },
    {
      organizationId: organization.id,
      releaseId: rel25061_1.id,
      revisionNumber: 2,
      revisionLabel: 'B',
      isCurrent: false,
      status: 'Superseded',
      approvedById: adminUser.id,
      notes: 'Superseded by Rev C for Swisspearl miter adjustments.',
    },
  ])

  const [relRev25061_1] = await db
    .insert(releaseRevisions)
    .values({
      organizationId: organization.id,
      releaseId: rel25061_1.id,
      revisionNumber: 3,
      revisionLabel: 'C',
      isCurrent: true,
      status: 'Approved',
      approvedById: adminUser.id,
      approvedAt: new Date(Date.now() - 86400000 * 5),
      notes:
        'Rev C: Precision CNC diamond toolpaths for 8mm Swisspearl Carat Black Opal.',
    })
    .returning()

  const r6PanelData = [
    {
      mark: 'AH-301',
      count: 4,
      width: '48.00',
      height: '96.00',
      color: 'Black Opal',
      finish: 'Hydrophobic Matte',
      type: 'Swisspearl Fiber Cement',
    },
    {
      mark: 'AH-302',
      count: 4,
      width: '48.00',
      height: '96.00',
      color: 'Black Opal',
      finish: 'Hydrophobic Matte',
      type: 'Swisspearl Fiber Cement',
    },
    {
      mark: 'AH-303',
      count: 4,
      width: '48.00',
      height: '120.00',
      color: 'Anthracite Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Chimney Flange',
    },
    {
      mark: 'AH-C01',
      count: 4,
      width: '24.00',
      height: '96.00',
      color: 'Black Opal',
      finish: 'Hydrophobic Matte',
      type: 'Swisspearl Miter Corner',
    },
    {
      mark: 'AH-S01',
      count: 4,
      width: '30.00',
      height: '84.00',
      color: 'Warm Bronze',
      finish: 'Mica 2-Coat PVDF',
      type: 'ACM Soffit Accent',
    },
  ]

  const r6PanelMap: Record<string, string> = {}
  for (const pm of r6PanelData) {
    const [saved] = await db
      .insert(panelMarks)
      .values({
        organizationId: organization.id,
        releaseRevisionId: relRev25061_1.id,
        mark: pm.mark,
        description: `${pm.type} — ${pm.color} (${pm.width}" × ${pm.height}")`,
        quantity: pm.count,
        materialFamily: pm.type.includes('Swisspearl') ? 'Swisspearl' : 'ACM',
        color: pm.color,
        thickness: pm.type.includes('Swisspearl') ? '0.3150' : '0.1575',
        width: pm.width,
        length: pm.height,
        dimensionUnit: 'in',
        notes: pm.type,
      })
      .returning()
    r6PanelMap[pm.mark] = saved.id

    await db.insert(operationInstances).values([
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25061_1.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-CNC'],
        sequence: 10,
        assignedWorkstationId: workstationMap['CNC-03'],
        status: 'Completed',
        plannedQuantity: pm.count,
        completedQuantity: pm.count,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25061_1.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-ELU'],
        sequence: 20,
        assignedWorkstationId: workstationMap['ELU-02'],
        status: 'Completed',
        plannedQuantity: pm.count,
        completedQuantity: pm.count,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25061_1.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-PREP'],
        sequence: 30,
        assignedWorkstationId: workstationMap['PREP-01'],
        status: 'Completed',
        plannedQuantity: pm.count,
        completedQuantity: pm.count,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25061_1.id,
        panelMarkId: saved.id,
        operationDefinitionId: opDefMap['OP-ASSY'],
        sequence: 40,
        assignedWorkstationId: workstationMap['ASSY-R3-S1'],
        status: 'In progress',
        plannedQuantity: pm.count,
        completedQuantity: 2,
      },
      {
        organizationId: organization.id,
        releaseRevisionId: relRev25061_1.id,
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

  // QC Pass with note on Swisspearl
  await db.insert(qualityInspections).values({
    organizationId: organization.id,
    releaseId: rel25061_1.id,
    releaseRevisionId: relRev25061_1.id,
    panelMarkId: r6PanelMap['AH-301'],
    inspectorId: adminUser.id,
    quantity: 4,
    disposition: 'Pass with note',
    notes:
      'Swisspearl edge impregnating hydrophobing compound applied to all cut edges per manufacturer specs.',
  })

  // Pallet building for Job 25061
  const [pal25061] = await db
    .insert(pallets)
    .values({
      organizationId: organization.id,
      palletNumber: 'PAL-25061-R1-001',
      releaseId: rel25061_1.id,
      releaseRevisionId: relRev25061_1.id,
      status: 'Building',
      elevation: 'Lodge North Gable',
      maxWeightLbs: '3000.00',
      currentWeightLbs: '510.00',
      panelCount: 4,
      notes:
        'Swisspearl fiber cement heavy pallet with protective foam interleaving',
    })
    .returning()

  await db.insert(palletItems).values([
    {
      organizationId: organization.id,
      palletId: pal25061.id,
      panelMarkId: r6PanelMap['AH-301'],
      quantity: 4,
    },
  ])

  // =========================================================================
  // 14. SEED RELEASE 7: JOB 25070 - RELEASE 1 (REV A) [STATUS: SCHEDULED / ALLOCATED]
  // =========================================================================
  console.log(
    '11. Seeding Release 7: Job 25070 - Release 1 (Scheduled & Allocated)...',
  )
  const [job25070] = await db
    .insert(productionJobs)
    .values({
      organizationId: organization.id,
      customerId: customerMap['SKYLINE'].customerId,
      projectId: customerMap['SKYLINE'].projectId,
      jobNumber: '25070',
      name: 'Cherry Creek Plaza Architectural Tower',
      status: 'Active',
    })
    .returning()

  const [rel25070_1] = await db
    .insert(releases)
    .values({
      organizationId: organization.id,
      jobId: job25070.id,
      releaseNumber: 1,
      status: 'In production',
      priority: 2,
      requiredDate: new Date(Date.now() + 86400000 * 30),
    })
    .returning()

  const [relRev25070_1] = await db
    .insert(releaseRevisions)
    .values({
      organizationId: organization.id,
      releaseId: rel25070_1.id,
      revisionNumber: 1,
      revisionLabel: 'A',
      isCurrent: true,
      status: 'Approved',
      approvedById: adminUser.id,
      approvedAt: new Date(Date.now() - 86400000 * 2),
      notes: 'Plaza Tower exterior spandrels and corner reveals.',
    })
    .returning()

  const r7PanelData = [
    {
      mark: 'CCP-101',
      count: 6,
      width: '48.00',
      height: '120.00',
      color: 'Bright Silver',
      finish: 'Metallic 3-Coat PVDF',
      type: 'ACM Tower Spandrel',
    },
    {
      mark: 'CCP-102',
      count: 6,
      width: '48.00',
      height: '120.00',
      color: 'Bright Silver',
      finish: 'Metallic 3-Coat PVDF',
      type: 'ACM Tower Spandrel',
    },
    {
      mark: 'CCP-103',
      count: 6,
      width: '48.00',
      height: '96.00',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Reveal Band',
    },
    {
      mark: 'CCP-104',
      count: 4,
      width: '36.00',
      height: '96.00',
      color: 'Charcoal Grey',
      finish: 'Solid 2-Coat PVDF',
      type: 'ACM Reveal Band',
    },
    {
      mark: 'CCP-201',
      count: 4,
      width: '24.00',
      height: '120.00',
      color: 'Bright Silver',
      finish: 'Metallic 3-Coat PVDF',
      type: 'ACM Chamfer Corner',
    },
  ]

  for (const pm of r7PanelData) {
    const [saved] = await db
      .insert(panelMarks)
      .values({
        organizationId: organization.id,
        releaseRevisionId: relRev25070_1.id,
        mark: pm.mark,
        description: `${pm.type} — ${pm.color} (${pm.width}" × ${pm.height}")`,
        quantity: pm.count,
        materialFamily: 'ACM',
        color: pm.color,
        thickness: '0.1575',
        width: pm.width,
        length: pm.height,
        dimensionUnit: 'in',
        notes: pm.type,
      })
      .returning()

    for (const [opCode, wsCode] of [
      ['OP-CNC', 'CNC-02'],
      ['OP-ELU', 'ELU-01'],
      ['OP-PREP', 'PREP-01'],
      ['OP-ASSY', 'ASSY-R2-S3'],
      ['OP-PACK', 'SHIP-01'],
    ]) {
      await db.insert(operationInstances).values({
        organizationId: organization.id,
        releaseRevisionId: relRev25070_1.id,
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
        status: 'Pending',
        plannedQuantity: pm.count,
        completedQuantity: 0,
      })
    }
  }

  // =========================================================================
  // 15. SEED INVENTORY, WAREHOUSE LOCATIONS, POs & TRANSACTIONS
  // =========================================================================
  console.log('12. Seeding Rich Inventory, Stock Levels & Purchase Orders...')
  const defaultLocations = [
    { code: 'BAY-A1', name: 'Sheet Goods Rack Bay A-1', zone: 'Warehouse' },
    { code: 'BAY-A2', name: 'Sheet Goods Rack Bay A-2', zone: 'Warehouse' },
    {
      code: 'BAY-B1',
      name: 'Specialty Fiber Cement Staging B-1',
      zone: 'Warehouse',
    },
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
      itemNumber: 'ACM-SB-48108',
      materialFamily: 'ACM',
      description: '4mm ACM Panel Sheet — Slate Blue (48" × 108")',
      manufacturer: 'Alpolic Materials Inc.',
      color: 'Slate Blue',
      finish: 'Solid 2-Coat PVDF',
      thickness: '0.1575',
      width: '48.0000',
      length: '108.0000',
      unit: 'sheets',
      reorderPoint: '15',
      reorderQuantity: '40',
      unitCost: '152.00',
    },
    {
      itemNumber: 'ACM-TM-60120',
      materialFamily: 'ACM',
      description: '4mm ACM Panel Sheet — Titanium Metallic (60" × 120")',
      manufacturer: 'Mitsubishi Chemical America',
      color: 'Titanium Metallic',
      finish: 'Metallic 3-Coat PVDF',
      thickness: '0.1575',
      width: '60.0000',
      length: '120.0000',
      unit: 'sheets',
      reorderPoint: '10',
      reorderQuantity: '30',
      unitCost: '185.00',
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

  // Stock Opening Balances
  await db.insert(inventoryTransactions).values([
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['ACM-CG-4896'],
      locationId: locationMap['BAY-A1'],
      transactionType: 'opening_balance',
      quantity: '80.0000',
      unit: 'sheets',
      lotNumber: 'LOT-2026-0815-CG',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Physical inventory baseline',
      notes: 'Warehouse stock for Charcoal Grey panels',
    },
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['ACM-BS-48120'],
      locationId: locationMap['BAY-A2'],
      transactionType: 'opening_balance',
      quantity: '60.0000',
      unit: 'sheets',
      lotNumber: 'LOT-2026-0818-BS',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Physical inventory baseline',
      notes: 'Warehouse stock for Bright Silver panels',
    },
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['ACM-BW-48120'],
      locationId: locationMap['BAY-A2'],
      transactionType: 'opening_balance',
      quantity: '45.0000',
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
      inventoryItemId: itemMap['ACM-SB-48108'],
      locationId: locationMap['BAY-A1'],
      transactionType: 'opening_balance',
      quantity: '30.0000',
      unit: 'sheets',
      lotNumber: 'LOT-2026-0820-SB',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Physical inventory baseline',
      notes: 'Stock for Denver Health Slate Blue panels',
    },
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['ACM-TM-60120'],
      locationId: locationMap['BAY-A2'],
      transactionType: 'opening_balance',
      quantity: '25.0000',
      unit: 'sheets',
      lotNumber: 'LOT-2026-0821-TM',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Physical inventory baseline',
      notes: 'Stock for Boulder Tech Titanium panels',
    },
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['SWISS-BO-4896'],
      locationId: locationMap['BAY-B1'],
      transactionType: 'opening_balance',
      quantity: '18.0000',
      unit: 'sheets',
      lotNumber: 'LOT-SWISS-2026-08',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Physical inventory baseline',
      notes: 'Swisspearl Carat fiber cement sheets',
    },
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['ALU-EXT-4001'],
      locationId: locationMap['RACK-EXT-01'],
      transactionType: 'opening_balance',
      quantity: '1200.0000',
      unit: 'ft',
      lotNumber: 'LOT-EXT-4001-A',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Extrusion rack stock count (50 bars x 24ft)',
      notes: 'Standard 4001 perimeter profile',
    },
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['ALU-EXT-4002'],
      locationId: locationMap['RACK-EXT-01'],
      transactionType: 'opening_balance',
      quantity: '720.0000',
      unit: 'ft',
      lotNumber: 'LOT-EXT-4002-A',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Extrusion rack stock count (30 bars x 24ft)',
      notes: 'Standard 4002 intermediate stiffener profile',
    },
    {
      organizationId: organization.id,
      inventoryItemId: itemMap['CLIP-ALU-25'],
      locationId: locationMap['BIN-HW-01'],
      transactionType: 'opening_balance',
      quantity: '2500.0000',
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
      quantity: '10000.0000',
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
      quantity: '3500.0000',
      unit: 'ft',
      lotNumber: 'LOT-GSK-2026-08',
      condition: 'good',
      actorId: adminUser.id,
      actingRole: 'System Administrator',
      reason: 'Weather gasket 7 spools count',
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
      orderDate: new Date(Date.now() - 86400000 * 3),
      expectedDate: new Date(Date.now() + 86400000 * 4),
      notes:
        'Replenishment for Job 25036 and Job 25048 ACM sheet requirements.',
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
      inventoryItemId: itemMap['ACM-TM-60120'],
      description: '4mm ACM Panel Sheet — Titanium Metallic (60" × 120")',
      orderedQuantity: '30.0000',
      receivedQuantity: '0.0000',
      unit: 'sheets',
      unitPrice: '185.00',
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
      orderDate: new Date(Date.now() - 86400000 * 6),
      expectedDate: new Date(Date.now() + 86400000 * 2),
      notes:
        'Accent sheet order for Denver Health and Salt Lake City canopy envelopes.',
    })
    .returning()

  await db.insert(purchaseOrderLines).values([
    {
      purchaseOrderId: po2.id,
      lineNumber: 1,
      inventoryItemId: itemMap['ACM-SB-48108'],
      description: '4mm ACM Panel Sheet — Slate Blue (48" × 108")',
      orderedQuantity: '40.0000',
      receivedQuantity: '20.0000',
      unit: 'sheets',
      unitPrice: '152.00',
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
      vendorName: 'Ellwood Standard Extrusions',
      status: 'Issued',
      orderDate: new Date(Date.now() - 86400000 * 1),
      expectedDate: new Date(Date.now() + 86400000 * 5),
      notes: 'Stock replenishment for 24ft ELU saw extrusions and stiffeners.',
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
      orderDate: new Date(Date.now() - 86400000 * 8),
      expectedDate: new Date(Date.now() - 86400000 * 2),
      notes: 'Assembly clips and fasteners shipment.',
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

  // =========================================================================
  // 16. SEED AUDIT LOG TIMELINE
  // =========================================================================
  console.log('13. Seeding Realistic Audit Trail Lineage...')
  await db.insert(auditEvents).values([
    {
      organizationId: organization.id,
      actorId: adminUser.id,
      actingRole: 'production_planner',
      action: 'release.intake_approved',
      resourceType: 'release',
      resourceId: rel25036_1.id,
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
      resourceId: r1PanelMap['P-101'],
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
      resourceId: r1PanelMap['P-101'],
      workstationId: workstationMap['QC-01'],
      priorState: { status: 'pending' },
      newState: { result: 'Pass', quantity: 4 },
      reason: 'Passed dimensional and finish QC inspection for Mark P-101.',
    },
    {
      organizationId: organization.id,
      actorId: adminUser.id,
      actingRole: 'quality_inspector',
      action: 'quality.issue_logged',
      resourceType: 'quality_issue',
      resourceId: issue25036.id,
      workstationId: workstationMap['QC-01'],
      priorState: { status: 'none' },
      newState: { issueNumber: 'ISSUE-25036-01', disposition: 'Remake' },
      reason: 'Face scratch logged on Mark P-103 during table offload.',
    },
    {
      organizationId: organization.id,
      actorId: adminUser.id,
      actingRole: 'production_planner',
      action: 'remake.authorized',
      resourceType: 'panel_mark_remake',
      resourceId: r1PanelMap['P-103'],
      priorState: { status: 'requested' },
      newState: { remakeMark: 'P-103-RMK-51', sequence: 51 },
      reason: 'Authorized Remake Sequence #51 for Mark P-103.',
    },
    {
      organizationId: organization.id,
      actorId: adminUser.id,
      actingRole: 'shipping_manager',
      action: 'pallet.staged',
      resourceType: 'pallet',
      resourceId: pal25036_1.id,
      priorState: { status: 'In Production' },
      newState: { status: 'Staged', location: 'STAGE-01' },
      reason: 'Staged Pallet PAL-25036-R1-001 (North Elevation) for shipment.',
    },
    {
      organizationId: organization.id,
      actorId: adminUser.id,
      actingRole: 'shipping_manager',
      action: 'shipment.dispatched',
      resourceType: 'shipment',
      resourceId: ship25036.id,
      priorState: { status: 'Draft' },
      newState: { status: 'Dispatched', bolNumber: 'BOL-25036-001' },
      reason:
        'Dispatched 53ft Flatbed carrier load for Tempe Gateway Phase II.',
    },
    {
      organizationId: organization.id,
      actorId: adminUser.id,
      actingRole: 'production_planner',
      action: 'release.revision_superseded',
      resourceType: 'release_revision',
      resourceId: relRev25036_2.id,
      priorState: { revision: 'A', status: 'current' },
      newState: { revision: 'B', status: 'Approved', isCurrent: true },
      reason:
        'Approved Revision B for Release 25036-2 with parapet miter updates.',
    },
  ])

  console.log('=== MULTI-RELEASE ENVIRONMENT SEEDING COMPLETE! ===')
  console.log(
    '7 distinct releases across 6 projects are now live across all screens!',
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
    console.error('Error seeding showcase releases:', err)
    process.exit(1)
  })
}
