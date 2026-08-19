import { randomBytes } from 'node:crypto'
import { eq, and } from 'drizzle-orm'
import { db, pool } from '@/db'
import {
  organizations,
  sites,
  users,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  configurationRules,
  operationDefinitions,
  operationInstances,
  documentClassifications,
  documents,
  documentRevisions,
  storedFiles,
  customers,
  projects,
  productionJobs,
  releases,
  releaseRevisions,
  panelMarks,
  auditEvents,
  activityEvents,
} from '@/db/schema'
import { hashPassword } from '@/lib/auth/password'
import { getEnvironment } from '@/lib/env'
import { STANDARD_ROLES, ROLE_PERMISSIONS_MATRIX } from '@/lib/services/domain'

async function main() {
  console.log(
    'Seeding Elward Flow database with Prompt 02 domain foundation...',
  )
  const environment = getEnvironment()

  // 1. Organization & Primary Site
  const [organization] = await db
    .insert(organizations)
    .values({
      name: 'Elward Systems — Local Development',
      slug: 'elward-local',
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: {
        name: 'Elward Systems — Local Development',
        updatedAt: new Date(),
      },
    })
    .returning()

  const [site] = await db
    .insert(sites)
    .values({
      organizationId: organization.id,
      name: 'Fictional Primary Plant',
      code: 'LOCAL',
      timezone: 'America/Denver',
    })
    .onConflictDoUpdate({
      target: [sites.organizationId, sites.code],
      set: { name: 'Fictional Primary Plant', updatedAt: new Date() },
    })
    .returning()

  // 2. Roles & Permissions Matrix
  console.log('Seeding 21 standard roles and permissions matrix...')
  const createdRoles: Record<string, string> = {}
  for (const roleName of STANDARD_ROLES) {
    const roleCode = roleName.toUpperCase().replace(/[\s\/\-]+/g, '_')
    const [roleRecord] = await db
      .insert(roles)
      .values({
        organizationId: organization.id,
        name: roleName,
        code: roleCode,
        description: `Standard role template: ${roleName}`,
        isSystem: true,
      })
      .onConflictDoUpdate({
        target: roles.code,
        set: { name: roleName, updatedAt: new Date() },
      })
      .returning()
    createdRoles[roleName] = roleRecord.id
  }

  const standardActions = [
    'view',
    'create',
    'edit',
    'approve',
    'override',
    'export',
    'configure',
    'administer',
  ]
  const standardResources = [
    'job',
    'release',
    'revision',
    'override',
    'configuration',
    'inventory',
    'quality',
    'pallet',
    'shipping',
    'document',
    'audit',
    'user',
  ]

  const createdPermissions: Record<string, string> = {}
  for (const res of standardResources) {
    for (const act of standardActions) {
      const [permRecord] = await db
        .insert(permissions)
        .values({
          resource: res,
          action: act,
          description: `Can ${act} on ${res}`,
        })
        .onConflictDoUpdate({
          target: [permissions.resource, permissions.action],
          set: { description: `Can ${act} on ${res}` },
        })
        .returning()
      createdPermissions[`${res}:${act}`] = permRecord.id
    }
  }

  // Link role permissions
  for (const [roleName, actions] of Object.entries(ROLE_PERMISSIONS_MATRIX)) {
    const roleId = createdRoles[roleName]
    if (!roleId) continue
    for (const act of actions) {
      for (const res of standardResources) {
        const permId = createdPermissions[`${res}:${act}`]
        if (permId) {
          await db
            .insert(rolePermissions)
            .values({ roleId, permissionId: permId })
            .onConflictDoNothing()
        }
      }
    }
  }

  // 3. Local Administrator User
  const password = `Local-${randomBytes(12).toString('base64url')}!`
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, environment.ADMIN_EMAIL))
    .limit(1)

  let adminUser = existingUsers[0]
  if (adminUser) {
    console.log(
      `Local administrator already exists: ${environment.ADMIN_EMAIL}. Password retained.`,
    )
  } else {
    const [created] = await db
      .insert(users)
      .values({
        organizationId: organization.id,
        siteId: site.id,
        name: 'Local Administrator',
        email: environment.ADMIN_EMAIL,
        passwordHash: await hashPassword(password),
        isAdmin: true,
      })
      .returning()
    adminUser = created

    console.log(`Local administrator created: ${environment.ADMIN_EMAIL}`)
    console.log(`One-time development password: ${password}`)
  }

  // Assign System Administrator & Operations Manager roles to Admin
  if (createdRoles['System Administrator']) {
    await db
      .insert(userRoles)
      .values({
        userId: adminUser.id,
        roleId: createdRoles['System Administrator'],
      })
      .onConflictDoNothing()
  }
  if (createdRoles['Operations Manager']) {
    await db
      .insert(userRoles)
      .values({
        userId: adminUser.id,
        roleId: createdRoles['Operations Manager'],
      })
      .onConflictDoNothing()
  }

  // 4. Default Configuration Rules
  console.log('Seeding baseline configuration rules...')
  const defaultRules = [
    {
      category: 'job_validation',
      ruleKey: 'pattern',
      activeValue: {
        regex: '^\\d{5}$',
        description: 'Strict 5-digit job numbers',
      },
    },
    {
      category: 'pallet_rules',
      ruleKey: 'borders',
      activeValue: {
        swisspearl_trespa_in: 1.5,
        srs_in: 2.0,
        dry_wet_per_in: 4.0,
      },
    },
    {
      category: 'pallet_rules',
      ruleKey: 'limits',
      activeValue: { max_weight_lbs: 3500, max_height_in: 60 },
    },
    {
      category: 'truck_templates',
      ruleKey: 'dimensions',
      activeValue: {
        full_truck: { length_ft: 53, width_in: 100 },
        hot_shot: { length_ft: 48, width_in: 100 },
        ltl: { configurable: true },
      },
    },
    {
      category: 'remake_rules',
      ruleKey: 'sequences',
      activeValue: { sequence_start: 51, rmk_prefix: 'RMK', rme_prefix: 'RME' },
    },
    {
      category: 'localization',
      ruleKey: 'units_timezone',
      activeValue: {
        timezone: 'America/Denver',
        units: { dimension: 'in', weight: 'lbs' },
      },
    },
  ]

  for (const rule of defaultRules) {
    const existingRule = await db
      .select()
      .from(configurationRules)
      .where(
        and(
          eq(configurationRules.organizationId, organization.id),
          eq(configurationRules.category, rule.category),
          eq(configurationRules.ruleKey, rule.ruleKey),
        ),
      )

    if (existingRule.length === 0) {
      await db.insert(configurationRules).values({
        organizationId: organization.id,
        category: rule.category,
        ruleKey: rule.ruleKey,
        activeValue: rule.activeValue,
        status: 'active',
        approvedById: adminUser.id,
      })
    }
  }

  // 5. Standard Operations & Document Classifications
  const operations = [
    {
      name: 'CNC Routing',
      code: 'CNC',
      department: 'CNC',
      defaultSequence: 10,
    },
    {
      name: 'ELU Extrusion Cut',
      code: 'ELU',
      department: 'ELU',
      defaultSequence: 20,
    },
    {
      name: 'Parts Preparation',
      code: 'PARTS',
      department: 'Assembly',
      defaultSequence: 30,
    },
    {
      name: 'Assembly',
      code: 'ASSY',
      department: 'Assembly',
      defaultSequence: 40,
    },
    {
      name: 'QC Inspection',
      code: 'QC',
      department: 'QC',
      defaultSequence: 50,
    },
    {
      name: 'Palletizing',
      code: 'PALLET',
      department: 'Shipping',
      defaultSequence: 60,
    },
    {
      name: 'Shipping',
      code: 'SHIP',
      department: 'Shipping',
      defaultSequence: 70,
    },
  ]

  for (const op of operations) {
    await db
      .insert(operationDefinitions)
      .values({
        organizationId: organization.id,
        name: op.name,
        code: op.code,
        department: op.department,
        defaultSequence: op.defaultSequence,
      })
      .onConflictDoNothing()
  }

  const classifications = [
    { name: 'Cut Drawings', code: 'CUT_DWG' },
    { name: 'Assembly Drawings', code: 'ASSY_DWG' },
    { name: 'Extrusion Cut Lists', code: 'EXT_LIST' },
    { name: 'Table/CNC Layouts', code: 'CNC_LAYOUT' },
    { name: 'Packing Lists', code: 'PACK_LIST' },
    { name: 'Elevations', code: 'ELEVATION' },
  ]

  for (const docClass of classifications) {
    await db
      .insert(documentClassifications)
      .values({
        organizationId: organization.id,
        name: docClass.name,
        code: docClass.code,
        expectedByDefault: true,
      })
      .onConflictDoNothing()
  }

  // 6. Fictional Manufacturing Sample Records
  console.log('Seeding fictional customer, project, 5-digit job and release...')
  const [customer] = await db
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

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: organization.id,
      customerId: customer.id,
      name: 'Tempe Gateway Commercial Center Phase II',
      code: 'TG-PH2',
      location: 'Tempe, AZ',
    })
    .returning()

  const [job] = await db
    .insert(productionJobs)
    .values({
      organizationId: organization.id,
      customerId: customer.id,
      projectId: project.id,
      jobNumber: '54120',
      name: 'Tempe Gateway Exterior Cladding',
      status: 'Active',
    })
    .onConflictDoNothing()
    .returning()

  if (job) {
    const [release] = await db
      .insert(releases)
      .values({
        organizationId: organization.id,
        jobId: job.id,
        releaseNumber: 1,
        status: 'Approved for production',
        priority: 1,
      })
      .onConflictDoNothing()
      .returning()

    if (release) {
      const [revision] = await db
        .insert(releaseRevisions)
        .values({
          organizationId: organization.id,
          releaseId: release.id,
          revisionNumber: 1,
          revisionLabel: 'A',
          status: 'Approved',
          isCurrent: true,
          approvedById: adminUser.id,
          approvedAt: new Date(),
          notes: 'Initial production release intake approved.',
        })
        .onConflictDoNothing()
        .returning()

      if (revision) {
        const createdMarks = await db
          .insert(panelMarks)
          .values([
            {
              organizationId: organization.id,
              releaseRevisionId: revision.id,
              mark: 'P-101',
              description: 'North Elevation Wall Panel',
              quantity: 24,
              materialFamily: 'ACM',
              color: 'Charcoal Grey',
              thickness: '0.1575',
              width: '48.0000',
              length: '96.0000',
              dimensionUnit: 'in',
            },
            {
              organizationId: organization.id,
              releaseRevisionId: revision.id,
              mark: 'P-102',
              description: 'South Elevation Accent Panel',
              quantity: 18,
              materialFamily: 'ACM',
              color: 'Bright Silver',
              thickness: '0.1575',
              width: '36.0000',
              length: '72.0000',
              dimensionUnit: 'in',
            },
            {
              organizationId: organization.id,
              releaseRevisionId: revision.id,
              mark: 'P-103',
              description: 'Entry Soffit Panel',
              quantity: 12,
              materialFamily: 'Swisspearl',
              color: 'Anthracite',
              thickness: '0.3150',
              width: '24.0000',
              length: '48.0000',
              dimensionUnit: 'in',
            },
          ])
          .returning()

        // Fetch created operation definitions
        const dbOpDefs = await db
          .select()
          .from(operationDefinitions)
          .where(eq(operationDefinitions.organizationId, organization.id))

        const cncDef = dbOpDefs.find((d) => d.code === 'CNC')
        const eluDef = dbOpDefs.find((d) => d.code === 'ELU')
        const qcDef = dbOpDefs.find((d) => d.code === 'QC')

        if (createdMarks[0] && cncDef && qcDef) {
          // P-101: CNC Complete (24 completed)
          await db.insert(operationInstances).values({
            organizationId: organization.id,
            releaseRevisionId: revision.id,
            panelMarkId: createdMarks[0].id,
            operationDefinitionId: cncDef.id,
            sequence: 10,
            status: 'Completed',
            plannedQuantity: 24,
            completedQuantity: 24,
          })
        }

        if (createdMarks[1] && qcDef && cncDef) {
          // P-102: In QC with 1 unit on hold
          await db.insert(operationInstances).values({
            organizationId: organization.id,
            releaseRevisionId: revision.id,
            panelMarkId: createdMarks[1].id,
            operationDefinitionId: qcDef.id,
            sequence: 50,
            status: 'Hold',
            plannedQuantity: 18,
            completedQuantity: 17,
            holdQuantity: 1,
            notes: 'Minor surface scratch detected on flange',
          })
        }

        if (createdMarks[2] && eluDef) {
          // P-103: In ELU prep
          await db.insert(operationInstances).values({
            organizationId: organization.id,
            releaseRevisionId: revision.id,
            panelMarkId: createdMarks[2].id,
            operationDefinitionId: eluDef.id,
            sequence: 20,
            status: 'In progress',
            plannedQuantity: 12,
            completedQuantity: 4,
          })
        }

        // Controlled Documents seeding
        const docClasses = await db
          .select()
          .from(documentClassifications)
          .where(eq(documentClassifications.organizationId, organization.id))

        const dummyFile = await db
          .insert(storedFiles)
          .values({
            organizationId: organization.id,
            objectKey: 'originals/fictional-drawings-pkg.pdf',
            originalName: '54120-1-Drawings-Packet.pdf',
            contentType: 'application/pdf',
            byteSize: 1048576,
            sha256:
              'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            uploadedById: adminUser.id,
          })
          .onConflictDoNothing()
          .returning()

        const fileId = dummyFile[0]?.id

        for (const dc of docClasses) {
          const [doc] = await db
            .insert(documents)
            .values({
              organizationId: organization.id,
              jobId: job.id,
              releaseId: release.id,
              classificationId: dc.id,
              name: `54120-1 ${dc.name}.pdf`,
            })
            .returning()

          if (fileId) {
            await db.insert(documentRevisions).values({
              documentId: doc.id,
              releaseRevisionId: revision.id,
              storedFileId: fileId,
              revisionLabel: 'A',
              status: 'current',
            })
          }
        }
      }
    }
  }

  // 7. Initial Activity Events & Audit Logs
  await db.insert(activityEvents).values([
    {
      organizationId: organization.id,
      actorId: adminUser.id,
      entityType: 'release',
      entityId: '54120-1',
      actionTitle: 'Release Intake Approved',
      summary: 'Approved Rev 1 (A) for shop floor production routing.',
    },
    {
      organizationId: organization.id,
      actorId: adminUser.id,
      entityType: 'job',
      entityId: '54120',
      actionTitle: 'Job Created',
      summary: 'Created Job 54120 for Tempe Gateway Commercial Partners.',
    },
    {
      organizationId: organization.id,
      actorId: adminUser.id,
      entityType: 'qc',
      entityId: 'P-102',
      actionTitle: 'QC Hold Placed',
      summary:
        'Held 1 unit of Mark P-102 for surface scratch rework inspection.',
    },
  ])

  await db.insert(auditEvents).values({
    organizationId: organization.id,
    actorId: adminUser.id,
    actingRole: 'System Administrator',
    action: 'SYSTEM_INIT',
    resourceType: 'system',
    resourceId: organization.id,
    reason:
      'Seeding baseline Prompt 02 and 03 domain model and configuration rules',
  })

  console.log('Database seeding completed successfully.')
  await pool.end()
}

main().catch((err) => {
  console.error('Database seed failure:', err)
  process.exit(1)
})
