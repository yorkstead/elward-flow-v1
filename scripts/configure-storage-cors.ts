import { PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3'
import { getEnvironment } from '@/lib/env'

async function main() {
  const environment = getEnvironment()
  const isProduction =
    environment.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  if (!isProduction) {
    console.log(
      'Local MinIO CORS is configured by docker-compose.yml; no bucket change required.',
    )
    return
  }
  const applicationOrigin = new URL(environment.APP_URL).origin
  const allowedOrigins = [applicationOrigin]
  const corsRule = {
    AllowedOrigins: allowedOrigins,
    AllowedMethods: ['PUT'],
    AllowedHeaders: ['content-type', 'x-amz-meta-sha256'],
    ExposeHeaders: ['etag'],
    MaxAgeSeconds: 3600,
  }
  if (
    new URL(environment.MINIO_ENDPOINT).hostname.endsWith(
      '.r2.cloudflarestorage.com',
    )
  ) {
    console.error(
      'Cloudflare R2 does not implement PutBucketCors through its S3-compatible API. Configure this rule in R2 > bucket > Settings > CORS Policy:',
    )
    console.error(JSON.stringify([corsRule], null, 2))
    process.exitCode = 1
    return
  }
  const client = new S3Client({
    endpoint: environment.MINIO_ENDPOINT,
    region: environment.MINIO_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: environment.MINIO_ACCESS_KEY,
      secretAccessKey: environment.MINIO_SECRET_KEY,
    },
  })

  await client.send(
    new PutBucketCorsCommand({
      Bucket: environment.MINIO_BUCKET,
      CORSConfiguration: {
        CORSRules: [corsRule],
      },
    }),
  )
  console.log(
    `Configured direct-upload CORS for ${environment.MINIO_BUCKET}: ${allowedOrigins.join(', ')}`,
  )
}

main().catch((error) => {
  console.error('Failed to configure storage CORS:', error)
  process.exit(1)
})
