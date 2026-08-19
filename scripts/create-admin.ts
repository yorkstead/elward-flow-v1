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

async function main() {
  console.log('Creating or updating local administrator account...')
  const environment = getEnvironment()
  const password = `Local-${randomBytes(12).toString('base64url')}!`

  // Ensure baseline organization exists
  const [org] = await db
    .insert(organizations)
    .values({
      name: 'Elward Systems — Local Development',
      slug: 'elward-local',
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: { updatedAt: new Date() },
    })
    .returning()

  // Ensure baseline site exists
  const [site] = await db
    .insert(sites)
    .values({
      organizationId: org.id,
      name: 'Fictional Primary Plant',
      code: 'LOCAL',
    })
    .onConflictDoUpdate({
      target: [sites.organizationId, sites.code],
      set: { updatedAt: new Date() },
    })
    .returning()

  // Ensure Admin role exists
  const [adminRole] = await db
    .insert(roles)
    .values({
      organizationId: org.id,
      name: 'System Administrator',
      code: 'SYSTEM_ADMINISTRATOR',
      description: 'Full system administrative access',
      isSystem: true,
    })
    .onConflictDoUpdate({
      target: roles.code,
      set: { updatedAt: new Date() },
    })
    .returning()

  // Insert or update admin user
  const hashedPassword = await hashPassword(password)
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, environment.ADMIN_EMAIL))
    .limit(1)

  let adminUser: typeof users.$inferSelect
  if (existing[0]) {
    const [updated] = await db
      .update(users)
      .set({
        passwordHash: hashedPassword,
        isAdmin: true,
        disabledAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing[0].id))
      .returning()
    adminUser = updated
    console.log(`Updated existing administrator: ${environment.ADMIN_EMAIL}`)
  } else {
    const [created] = await db
      .insert(users)
      .values({
        organizationId: org.id,
        siteId: site.id,
        name: 'Local Administrator',
        email: environment.ADMIN_EMAIL,
        passwordHash: hashedPassword,
        isAdmin: true,
      })
      .returning()
    adminUser = created
    console.log(`Created new administrator: ${environment.ADMIN_EMAIL}`)
  }

  // Link role
  await db
    .insert(userRoles)
    .values({
      userId: adminUser.id,
      roleId: adminRole.id,
    })
    .onConflictDoNothing()

  // Audit log
  await db.insert(auditEvents).values({
    organizationId: org.id,
    actorId: adminUser.id,
    actingRole: 'System Administrator',
    action: 'ADMIN_CREDENTIALS_SET',
    resourceType: 'user',
    resourceId: adminUser.id,
    reason: 'Administrative CLI command execution',
  })

  console.log('==================================================')
  console.log(`Email: ${environment.ADMIN_EMAIL}`)
  console.log(`Password: ${password}`)
  console.log('Store this one-time password in your manager.')
  console.log('==================================================')

  await pool.end()
}

main().catch((err) => {
  console.error('Failed to create admin:', err)
  process.exit(1)
})
