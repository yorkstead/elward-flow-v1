import { z } from 'zod'

const serverEnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_URL: z.url(),
  AUTH_SECRET: z.string().min(32),
  DATABASE_URL: z.string().min(1),
  MINIO_ENDPOINT: z.url(),
  MINIO_REGION: z.string().min(1).default('us-east-1'),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(3),
  ADMIN_EMAIL: z.email().default('admin@example.test'),
  E2E_ADMIN_PASSWORD: z.string().min(12).optional(),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>

let cachedEnvironment: ServerEnvironment | undefined

export function getEnvironment(): ServerEnvironment {
  if (cachedEnvironment) return cachedEnvironment
  const result = serverEnvironmentSchema.safeParse(process.env)
  if (!result.success) {
    throw new Error(
      `Invalid server environment: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    )
  }
  cachedEnvironment = result.data
  return cachedEnvironment
}
