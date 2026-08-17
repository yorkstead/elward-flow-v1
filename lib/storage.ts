import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { createHash } from 'crypto'

const minioEndpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000'
const bucketName = process.env.MINIO_BUCKET || 'elward-flow-local'

export const s3Client = new S3Client({
  endpoint: minioEndpoint,
  forcePathStyle: true,
  region: process.env.MINIO_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'elward-local',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'elward-local-password',
  },
})

export interface UploadMetadata {
  hash: string
  mimeType: string
  size: number
  uploader: string
  classification: string
}

export async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  uploader: string,
  classification: string,
): Promise<UploadMetadata> {
  const hash = createHash('sha256').update(fileBuffer).digest('hex')
  const size = fileBuffer.length
  const storageKey = `uploads/${hash}-${fileName}` // Enforce file immutability

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
    Body: fileBuffer,
    ContentType: 'application/pdf',
    Metadata: {
      uploader,
      classification,
      hash,
    },
  })

  await s3Client.send(command)

  return {
    hash,
    mimeType: 'application/pdf',
    size,
    uploader,
    classification,
  }
}

export async function testStorageConnection(): Promise<boolean> {
  try {
    const testCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: 'non-existent-probe-file',
    })
    await s3Client.send(testCommand).catch((err) => {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return true
      }
      throw err
    })
    return true
  } catch (error) {
    console.error('Storage connection probe failed:', error)
    return false
  }
}
