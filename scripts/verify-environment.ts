import { getEnvironment } from '@/lib/env'
import { pool } from '@/db'
import { getFileStore } from '@/lib/files/minio-file-store'
import { sha256 } from '@/lib/files/hash'

interface CheckResult {
  name: string
  status: 'passed' | 'failed' | 'warning'
  detail: string
  latencyMs?: number
}

async function verifyEnvironment(): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  // 1. Validate Environment Variables
  const envStart = Date.now()
  try {
    const env = getEnvironment()
    results.push({
      name: 'Environment Variables (Zod Validation)',
      status: 'passed',
      detail: `All required variables parsed successfully (NODE_ENV: ${env.NODE_ENV}, APP_URL: ${env.APP_URL}, MINIO_BUCKET: ${env.MINIO_BUCKET})`,
      latencyMs: Date.now() - envStart,
    })
  } catch (error) {
    results.push({
      name: 'Environment Variables (Zod Validation)',
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - envStart,
    })
    return results
  }

  // 2. Validate PostgreSQL / Neon Database Connectivity
  const dbStart = Date.now()
  try {
    const pingRes = await pool.query(
      'SELECT current_database(), version(), now()',
    )
    const dbName = pingRes.rows[0]?.current_database || 'unknown'
    const dbVersion =
      (pingRes.rows[0]?.version || '').split(' ')[0] || 'PostgreSQL'

    // Check key tables existence
    const tableRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('organizations', 'users', 'production_jobs', 'releases', 'panel_marks', 'audit_events')
    `)
    const tableCount = tableRes.rowCount || 0

    if (tableCount >= 5) {
      results.push({
        name: 'Database (PostgreSQL / Neon)',
        status: 'passed',
        detail: `Connected to ${dbName} (${dbVersion}) with ${tableCount}+ core tables verified`,
        latencyMs: Date.now() - dbStart,
      })
    } else {
      results.push({
        name: 'Database (PostgreSQL / Neon)',
        status: 'warning',
        detail: `Connected to ${dbName} but only found ${tableCount}/6 sample tables. Run 'bun run db:migrate' if migrations are pending.`,
        latencyMs: Date.now() - dbStart,
      })
    }
  } catch (error) {
    results.push({
      name: 'Database (PostgreSQL / Neon)',
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - dbStart,
    })
  }

  // 3. Validate Object Storage (Cloudflare R2 / MinIO) Read/Write/Delete & Presigned URLs
  const storageStart = Date.now()
  try {
    const fileStore = getFileStore()
    await fileStore.ensureReady()

    const testKey = `staging/env-verification-${crypto.randomUUID()}.txt`
    const testContent = Buffer.from(
      `Elward Flow Health Verification: ${new Date().toISOString()}`,
    )
    const expectedDigest = sha256(testContent)

    // Test Put
    await fileStore.putImmutable({
      key: testKey,
      body: testContent,
      contentType: 'text/plain',
      expectedSha256: expectedDigest,
    })

    // Test Get & Digest Match
    const retrieved = await fileStore.get(testKey)
    if (
      retrieved.body.byteLength !== testContent.byteLength ||
      retrieved.sha256 !== expectedDigest
    ) {
      throw new Error(
        'Retrieved test object did not match uploaded byte length or SHA-256 digest',
      )
    }

    // Test Presigned Direct Upload URL creation
    const presigned = await fileStore.createDirectUpload({
      key: `staging/presigned-check-${crypto.randomUUID()}.dat`,
      contentType: 'application/octet-stream',
      byteSize: 1024,
      sha256: expectedDigest,
      expiresInSeconds: 300,
    })

    if (!presigned.url || !presigned.headers['x-amz-meta-sha256']) {
      throw new Error(
        'Presigned upload URL generation failed to produce valid URL or SHA-256 header',
      )
    }

    // Cleanup Put test object
    await fileStore.delete(testKey)

    results.push({
      name: 'Object Storage (Cloudflare R2 / MinIO)',
      status: 'passed',
      detail: `Verified put/get/delete lifecycle and presigned direct-upload authorization on bucket '${getEnvironment().MINIO_BUCKET}'`,
      latencyMs: Date.now() - storageStart,
    })
  } catch (error) {
    results.push({
      name: 'Object Storage (Cloudflare R2 / MinIO)',
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - storageStart,
    })
  }

  // 4. Validate Background Job Worker Queue Table
  const workerStart = Date.now()
  try {
    const jobsRes = await pool.query(`
      SELECT count(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'jobs'
    `)
    if (Number(jobsRes.rows[0]?.count) > 0) {
      results.push({
        name: 'Background Job Queue (PostgreSQL Worker Table)',
        status: 'passed',
        detail: `Verified 'jobs' queue table is present and accessible`,
        latencyMs: Date.now() - workerStart,
      })
    } else {
      results.push({
        name: 'Background Job Queue (PostgreSQL Worker Table)',
        status: 'warning',
        detail: `'jobs' table not found in public schema. Run 'bun run db:migrate'.`,
        latencyMs: Date.now() - workerStart,
      })
    }
  } catch (error) {
    results.push({
      name: 'Background Job Queue (PostgreSQL Worker Table)',
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - workerStart,
    })
  }

  return results
}

async function main() {
  console.log(
    '=================================================================',
  )
  console.log('  ELWARD FLOW — PRODUCTION & ENVIRONMENT READINESS VERIFIER')
  console.log(
    '=================================================================\n',
  )

  const results = await verifyEnvironment()

  let hasFailure = false
  for (const r of results) {
    const icon =
      r.status === 'passed'
        ? '✓ [PASS]'
        : r.status === 'warning'
          ? '⚠ [WARN]'
          : '✗ [FAIL]'
    const latency = r.latencyMs !== undefined ? ` (${r.latencyMs}ms)` : ''
    console.log(`${icon} ${r.name}${latency}`)
    console.log(`       ${r.detail}\n`)
    if (r.status === 'failed') hasFailure = true
  }

  // Close database pool connection cleanly
  try {
    await pool.end()
  } catch {
    // ignore
  }

  if (hasFailure) {
    console.error(
      'Environment verification FAILED: One or more critical subsystems are not ready.',
    )
    process.exit(1)
  } else {
    console.log(
      'Environment verification SUCCEEDED: All infrastructure components are verified.',
    )
  }
}

main().catch((err) => {
  console.error('Fatal verification error:', err)
  process.exit(1)
})
