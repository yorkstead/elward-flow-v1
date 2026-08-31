import { z } from 'zod'

const isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.npm_lifecycle_event === 'build'

const serverEnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_URL: z.url().default('http://localhost:3000'),
  AUTH_SECRET: isBuildPhase
    ? z.string().min(32).default('synthetic_build_secret_32_characters_minimum')
    : z.string().min(32),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://postgres:postgres@localhost:5432/elward_flow'),
  MINIO_ENDPOINT: z.url().default('http://localhost:9000'),
  MINIO_REGION: z.string().min(1).default('us-east-1'),
  MINIO_ACCESS_KEY: z.string().min(1).default('minio_build_access_key'),
  MINIO_SECRET_KEY: z.string().min(1).default('minio_build_secret_key'),
  MINIO_BUCKET: z.string().min(3).default('elward-flow-build'),
  ADMIN_EMAIL: z.email().default('admin@example.test'),
  E2E_ADMIN_PASSWORD: z.string().min(12).optional(),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>

let cachedEnvironment: ServerEnvironment | undefined

export function normalizeEnvironment(
  rawEnv: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {}

  for (const [key, value] of Object.entries(rawEnv)) {
    if (value !== undefined) {
      const trimmed = value.trim()
      if (trimmed !== '' && !trimmed.includes('[SENSITIVE]')) {
        normalized[key] = trimmed
      }
    }
  }

  // Resolve APP_URL from APP_URL or VERCEL_URL if provided
  let appUrl =
    normalized.APP_URL ||
    (normalized.VERCEL_URL ? `https://${normalized.VERCEL_URL}` : undefined)

  if (appUrl) {
    if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
      appUrl = `https://${appUrl}`
    }
    normalized.APP_URL = appUrl
  }

  // Normalize LOG_LEVEL to lowercase or remove if invalid
  if (normalized.LOG_LEVEL) {
    const lower = normalized.LOG_LEVEL.toLowerCase()
    if (['debug', 'info', 'warn', 'error'].includes(lower)) {
      normalized.LOG_LEVEL = lower
    } else {
      delete normalized.LOG_LEVEL
    }
  }

  return normalized
}

export function getEnvironment(): ServerEnvironment {
  if (cachedEnvironment) return cachedEnvironment
  const sanitized = normalizeEnvironment(process.env)
  const result = serverEnvironmentSchema.safeParse(sanitized)
  if (!result.success) {
    throw new Error(
      `Invalid server environment: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    )
  }
  cachedEnvironment = result.data
  return cachedEnvironment
}
