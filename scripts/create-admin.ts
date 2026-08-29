import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, pool } from '@/db'
import {
  organizations,
  sites,
  users,
  roles,
  userRoles,
  auditEvents,
} from '@/db/schema'
import { hashPassword } from '@/lib/auth/password'
import { getEnvironment } from '@/lib/env'
import { STANDARD_ROLES } from '@/lib/services/domain'

async function main() {
  const environment = getEnvironment()
  const args = process.argv.slice(2)

  let email = ''
  let password = ''
  let name = 'System Owner'

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--email' || args[i] === '-e') && args[i + 1]) {
      email = args[++i]
    } else if ((args[i] === '--password' || args[i] === '-p') && args[i + 1]) {
      password = args[++i]
    } else if ((args[i] === '--name' || args[i] === '-n') && args[i + 1]) {
      name = args[++i]
    } else if (!args[i].startsWith('--') && !email) {
      email = args[i]
    }
  }

  if (!email) {
    email = environment.ADMIN_EMAIL || 'owner@ellwoodsystems.com'
  }
  if (!password) {
    password = `Ellwood-${randomBytes(8).toString('hex')}!`
  }

  console.log(`Creating or updating administrator/owner account: ${email}...`)

  // 1. Ensure baseline organization exists
  let [org] = await db.select().from(organizations).limit(1)
  if (!org) {
    ;[org] = await db
      .insert(organizations)
      .values({
        name: 'Ellwood Systems — Local Development',
        slug: 'ellwood-local',
      })
      .returning()
  }

  // 2. Ensure baseline site exists
  let [site] = await db
    .select()
    .from(sites)
    .where(eq(sites.organizationId, org.id))
    .limit(1)

  if (!site) {
    ;[site] = await db
      .insert(sites)
      .values({
        organizationId: org.id,
        name: 'Primary Plant',
        code: 'MAIN',
        isProductionFacility: true,
      })
      .returning()
  }

  // 3. Ensure System Administrator and Executive Roles exist
  const roleMap: Record<string, string> = {}
  for (const roleName of STANDARD_ROLES) {
    const roleCode = roleName.toUpperCase().replace(/[\s\/\-]+/g, '_')
    let [roleRecord] = await db
      .select()
      .from(roles)
      .where(eq(roles.code, roleCode))
      .limit(1)

    if (!roleRecord) {
      ;[roleRecord] = await db
        .insert(roles)
        .values({
          organizationId: org.id,
          name: roleName,
          code: roleCode,
          description: `Standard role template: ${roleName}`,
          isSystem: true,
        })
        .returning()
    }
    roleMap[roleName] = roleRecord.id
  }

  // 4. Insert or update user
  const hashedPassword = await hashPassword(password)
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  let targetUser: typeof users.$inferSelect
  if (existing[0]) {
    const [updated] = await db
      .update(users)
      .set({
        name,
        passwordHash: hashedPassword,
        isAdmin: true,
        disabledAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing[0].id))
      .returning()
    targetUser = updated
    console.log(`Updated existing administrator/owner credentials: ${email}`)
  } else {
    const [created] = await db
      .insert(users)
      .values({
        organizationId: org.id,
        siteId: site.id,
        name,
        email,
        passwordHash: hashedPassword,
        isAdmin: true,
      })
      .returning()
    targetUser = created
    console.log(`Created new administrator/owner: ${email}`)
  }

  // 5. Link standard executive & admin roles
  const rolesToAssign = [
    'System Administrator',
    'Executive',
    'Operations Manager',
    'Production Manager',
  ]
  for (const rName of rolesToAssign) {
    const rId = roleMap[rName]
    if (rId) {
      await db
        .insert(userRoles)
        .values({
          userId: targetUser.id,
          roleId: rId,
        })
        .onConflictDoNothing()
    }
  }

  // 6. Audit log
  await db.insert(auditEvents).values({
    organizationId: org.id,
    actorId: targetUser.id,
    actingRole: 'System Administrator',
    action: 'ADMIN_CREDENTIALS_SET',
    resourceType: 'user',
    resourceId: targetUser.id,
    reason: 'Owner credentials provisioned via CLI',
  })

  console.log('\n==================================================')
  console.log('OWNER / ADMINISTRATOR ACCOUNT CREDENTIALS')
  console.log('==================================================')
  console.log(`Name:     ${targetUser.name}`)
  console.log(`Email:    ${email}`)
  console.log(`Password: ${password}`)
  console.log(`Roles:    ${rolesToAssign.join(', ')}`)
  console.log('==================================================\n')

  await pool.end()
}

main().catch((err) => {
  console.error('Failed to create admin:', err)
  process.exit(1)
})
