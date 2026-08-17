import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { getEnvironment } from '@/lib/env'
import * as schema from './schema'

const globalDatabase = globalThis as unknown as { pool?: Pool }

export const pool =
  globalDatabase.pool ??
  new Pool({ connectionString: getEnvironment().DATABASE_URL, max: 10 })
if (process.env.NODE_ENV !== 'production') globalDatabase.pool = pool

export const db = drizzle(pool, { schema })
