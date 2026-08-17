import { db, pool } from '../lib/db'
import { jobs } from '../lib/db/schema'

async function main() {
  console.log('Seeding local development database...')

  await db
    .insert(jobs)
    .values([
      {
        job_number: '54120',
        customer: 'Tempe Gateway Commercial Partners',
      },
      {
        job_number: '54121',
        customer: 'Colorado State University RIC',
      },
    ])
    .onConflictDoNothing()

  console.log('Database seeding completed successfully.')
  await pool.end()
}

main().catch((err) => {
  console.error('Database seed failure:', err)
  process.exit(1)
})
