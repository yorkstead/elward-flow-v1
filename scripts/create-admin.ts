import { db, pool } from '../lib/db'
import { auditLogs } from '../lib/db/schema'

async function main() {
  console.log('Creating default local admin account references...')

  await db.insert(auditLogs).values({
    user_email: 'admin@example.test',
    action: 'SYSTEM_INIT',
    target_id: '00000',
    reason: 'Seeding baseline admin and configuration records',
    payload: JSON.stringify({ role: 'Administrator', active: true }),
  })

  console.log('Local administrator configuration completed.')
  await pool.end()
}

main().catch((err) => {
  console.error('Failed to create admin:', err)
  process.exit(1)
})
