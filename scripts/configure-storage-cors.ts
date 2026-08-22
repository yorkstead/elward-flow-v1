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
        CORSRules: [
          {
            AllowedOrigins: allowedOrigins,
            AllowedMethods: ['PUT'],
            AllowedHeaders: ['content-type'],
            ExposeHeaders: ['etag'],
            MaxAgeSeconds: 3600,
          },
        ],
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
