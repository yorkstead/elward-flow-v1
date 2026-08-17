import { pool } from '@/db'

const result = await pool.query(
  `select (select count(*) from organizations) organizations, (select count(*) from users) users, (select count(*) from jobs) jobs`,
)
if (
  Number(result.rows[0].organizations) < 1 ||
  Number(result.rows[0].users) < 1
)
  throw new Error(
    'Restore verification failed: required foundation records are missing',
  )
console.log(JSON.stringify({ status: 'verified', counts: result.rows[0] }))
await pool.end()
