import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, pool } from '@/db'
import { organizations, sites, users } from '@/db/schema'
import { hashPassword } from '@/lib/auth/password'
import { getEnvironment } from '@/lib/env'

const environment = getEnvironment()
const password = `Local-${randomBytes(12).toString('base64url')}!`

const [organization] = await db
  .insert(organizations)
  .values({ name: 'Elward Systems — Local Development', slug: 'elward-local' })
  .onConflictDoUpdate({
    target: organizations.slug,
    set: { name: 'Elward Systems — Local Development', updatedAt: new Date() },
  })
  .returning()
const [site] = await db
  .insert(sites)
  .values({
    organizationId: organization.id,
    name: 'Fictional Primary Plant',
    code: 'LOCAL',
  })
  .onConflictDoUpdate({
    target: [sites.organizationId, sites.code],
    set: { name: 'Fictional Primary Plant', updatedAt: new Date() },
  })
  .returning()
const existing = await db
  .select()
  .from(users)
  .where(eq(users.email, environment.ADMIN_EMAIL))
  .limit(1)
if (existing[0]) {
  console.log(
    `Local administrator already exists: ${environment.ADMIN_EMAIL}. Password was not changed.`,
  )
} else {
  await db.insert(users).values({
    organizationId: organization.id,
    siteId: site.id,
    name: 'Local Administrator',
    email: environment.ADMIN_EMAIL,
    passwordHash: await hashPassword(password),
    isAdmin: true,
  })
  console.log(`Local administrator created: ${environment.ADMIN_EMAIL}`)
  console.log(`One-time development password: ${password}`)
  console.log(
    'Store it in your password manager; it will not be printed again.',
  )
}
await pool.end()
