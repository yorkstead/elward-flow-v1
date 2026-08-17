import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, pool } from '@/db'
import { organizations, sites, users } from '@/db/schema'
import { hashPassword } from '@/lib/auth/password'
import { getEnvironment } from '@/lib/env'

const email = (process.argv[2] ?? getEnvironment().ADMIN_EMAIL)
  .trim()
  .toLowerCase()
const [organization] = await db
  .select()
  .from(organizations)
  .where(eq(organizations.slug, 'elward-local'))
  .limit(1)
if (!organization)
  throw new Error('Run the seed command before creating another administrator')
const [site] = await db
  .select()
  .from(sites)
  .where(eq(sites.organizationId, organization.id))
  .limit(1)
const [existing] = await db
  .select()
  .from(users)
  .where(eq(users.email, email))
  .limit(1)
if (existing) throw new Error(`User already exists: ${email}`)
const password = `Local-${randomBytes(12).toString('base64url')}!`
await db.insert(users).values({
  organizationId: organization.id,
  siteId: site?.id,
  name: 'Local Administrator',
  email,
  passwordHash: await hashPassword(password),
  isAdmin: true,
})
console.log(`Local administrator created: ${email}`)
console.log(`One-time development password: ${password}`)
await pool.end()
