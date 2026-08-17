import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getEnvironment } from '@/lib/env'

mkdirSync('backups', { recursive: true })
const destination = join(
  'backups',
  `elward-flow-${new Date().toISOString().replaceAll(':', '-')}.dump`,
)
const databaseUrl = new URL(getEnvironment().DATABASE_URL)
const result = spawnSync(
  'docker',
  [
    'compose',
    'exec',
    '-T',
    'postgres',
    'pg_dump',
    '--format=custom',
    '--username',
    decodeURIComponent(databaseUrl.username),
    databaseUrl.pathname.slice(1),
  ],
  { encoding: null, maxBuffer: 256 * 1024 * 1024 },
)
if (result.status !== 0)
  throw new Error(
    `pg_dump failed: ${result.stderr?.toString() ?? 'unknown error'}`,
  )
writeFileSync(destination, result.stdout)
console.log(`Backup written to ${destination}`)
