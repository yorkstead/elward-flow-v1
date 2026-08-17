import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getEnvironment } from '@/lib/env'
import { sha256 } from './hash'
import type { FileStore, PutImmutableObjectInput } from './file-store'

export class MinioFileStore implements FileStore {
  private readonly environment = getEnvironment()
  private readonly client = new S3Client({
    endpoint: this.environment.MINIO_ENDPOINT,
    region: this.environment.MINIO_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: this.environment.MINIO_ACCESS_KEY,
      secretAccessKey: this.environment.MINIO_SECRET_KEY,
    },
  })

  async ensureReady() {
    try {
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.environment.MINIO_BUCKET }),
      )
    } catch {
      if (this.environment.NODE_ENV === 'production')
        throw new Error('Object storage bucket is unavailable')
      await this.client.send(
        new CreateBucketCommand({ Bucket: this.environment.MINIO_BUCKET }),
      )
    }
  }

  async putImmutable(input: PutImmutableObjectInput) {
    if (!input.key.startsWith('originals/'))
      throw new Error('Immutable uploads must use the originals/ namespace')
    const digest = sha256(input.body)
    if (input.expectedSha256 && input.expectedSha256 !== digest)
      throw new Error('Upload hash does not match expected SHA-256')
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.environment.MINIO_BUCKET,
          Key: input.key,
        }),
      )
      throw new Error('Immutable object already exists')
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Immutable object already exists'
      )
        throw error
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.environment.MINIO_BUCKET,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: { sha256: digest },
      }),
    )
    const stored = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.environment.MINIO_BUCKET,
        Key: input.key,
      }),
    )
    if (
      stored.Metadata?.sha256 !== digest ||
      stored.ContentLength !== input.body.byteLength
    )
      throw new Error('Stored object verification failed')
    return {
      key: input.key,
      contentType: input.contentType,
      byteSize: input.body.byteLength,
      sha256: digest,
    }
  }

  async get(key: string) {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.environment.MINIO_BUCKET, Key: key }),
    )
    if (!result.Body) throw new Error('Stored object body is missing')
    const bytes = await result.Body.transformToByteArray()
    const digest = sha256(bytes)
    if (result.Metadata?.sha256 !== digest)
      throw new Error('Retrieved object hash verification failed')
    return {
      body: bytes,
      contentType: result.ContentType ?? 'application/octet-stream',
      sha256: digest,
    }
  }
}

let fileStore: FileStore | undefined
export function getFileStore(): FileStore {
  return (fileStore ??= new MinioFileStore())
}
