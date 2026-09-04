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
  documentClassifications,
  workstations,
} from '@/db/schema'
import { hashPassword } from '@/lib/auth/password'
import { getEnvironment } from '@/lib/env'
import { STANDARD_ROLES, ROLE_PERMISSIONS_MATRIX } from '@/lib/services/domain'
import { seedShowcaseRelease } from './seed-showcase-release'

async function main() {
  console.log(
    'Seeding Elward Flow database with Prompt 02 domain foundation...',
  )
  const environment = getEnvironment()
  if (environment.NODE_ENV === 'production')
    throw new Error('Synthetic seed is not permitted in production')

  // 1. Organization & Primary Site
  const [organization] = await db
    .insert(organizations)
    .values({
      name: 'Ellwood Systems — Local Development',
      slug: 'ellwood-local',
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: {
        name: 'Ellwood Systems — Local Development',
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
      isProductionFacility: true,
      timezone: 'America/Denver',
    })
    .onConflictDoUpdate({
      target: [sites.organizationId, sites.code],
      set: {
        name: 'Fictional Primary Plant',
        isProductionFacility: true,
        updatedAt: new Date(),
      },
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
  const password =
    environment.NODE_ENV === 'test' && environment.E2E_ADMIN_PASSWORD
      ? environment.E2E_ADMIN_PASSWORD
      : `Local-${randomBytes(12).toString('base64url')}!`
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, environment.ADMIN_EMAIL))
    .limit(1)

  let adminUser = existingUsers[0]
  if (adminUser) {
    if (environment.NODE_ENV === 'test' && environment.E2E_ADMIN_PASSWORD) {
      const [updated] = await db
        .update(users)
        .set({
          passwordHash: await hashPassword(environment.E2E_ADMIN_PASSWORD),
          updatedAt: new Date(),
        })
        .where(eq(users.id, adminUser.id))
        .returning()
      adminUser = updated
      console.log(
        `Local administrator test credentials refreshed: ${environment.ADMIN_EMAIL}.`,
      )
    } else {
      console.log(
        `Local administrator already exists: ${environment.ADMIN_EMAIL}. Password retained.`,
      )
    }
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

  // Seed standard workstations
  const defaultWorkstations = [
    { name: 'CNC Router 1', code: 'CNC-01', department: 'CNC' },
    { name: 'CNC Router 2', code: 'CNC-02', department: 'CNC' },
    { name: 'CNC Router 3', code: 'CNC-03', department: 'CNC' },
    { name: 'ELU Extrusion Saw 1', code: 'ELU-01', department: 'ELU' },
    { name: 'ELU Extrusion Saw 2', code: 'ELU-02', department: 'ELU' },
    {
      name: 'Parts Preparation Area',
      code: 'PREP-01',
      department: 'Parts Prep',
    },
    {
      name: 'Assembly Row 1 - Station 1',
      code: 'ASSY-R1-S1',
      department: 'Assembly',
    },
    {
      name: 'Assembly Row 1 - Station 2',
      code: 'ASSY-R1-S2',
      department: 'Assembly',
    },
    {
      name: 'Assembly Row 1 - Station 3',
      code: 'ASSY-R1-S3',
      department: 'Assembly',
    },
    {
      name: 'Assembly Row 2 - Station 1',
      code: 'ASSY-R2-S1',
      department: 'Assembly',
    },
    {
      name: 'Assembly Row 2 - Station 2',
      code: 'ASSY-R2-S2',
      department: 'Assembly',
    },
    {
      name: 'Assembly Row 2 - Station 3',
      code: 'ASSY-R2-S3',
      department: 'Assembly',
    },
    {
      name: 'Assembly Row 3 - Station 1',
      code: 'ASSY-R3-S1',
      department: 'Assembly',
    },
    {
      name: 'Assembly Row 3 - Station 2',
      code: 'ASSY-R3-S2',
      department: 'Assembly',
    },
    {
      name: 'Assembly Row 3 - Station 3',
      code: 'ASSY-R3-S3',
      department: 'Assembly',
    },
    { name: 'Main QC Inspection', code: 'QC-01', department: 'QC' },
    {
      name: 'Palletizing & Shipping Area',
      code: 'SHIP-01',
      department: 'Shipping',
    },
  ]

  for (const ws of defaultWorkstations) {
    const [existing] = await db
      .select()
      .from(workstations)
      .where(eq(workstations.code, ws.code))
      .limit(1)

    if (!existing) {
      await db.insert(workstations).values({
        siteId: site.id,
        name: ws.name,
        code: ws.code,
        department: ws.department,
        isActive: true,
      })
    }
  }

  // 6. Complete Showcase Demonstration Dataset (Job 25036)
  await seedShowcaseRelease(false)

  console.log('Database seeding completed successfully.')
  await pool.end()
}

main().catch((err) => {
  console.error('Database seed failure:', err)
  process.exit(1)
})
