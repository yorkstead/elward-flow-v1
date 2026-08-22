import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { getFileStore } from '@/lib/files/minio-file-store'
import { sha256 } from '@/lib/files/hash'
import { sanitizeUploadFilename } from '@/lib/intake-upload'

async function main() {
  const sourcePath = process.argv[2]
  if (!sourcePath)
    throw new Error(
      'Usage: bun run storage:verify-direct-upload -- <package-path>',
    )

  const body = await readFile(sourcePath)
  const digest = sha256(body)
  const key = `staging/direct-upload-verification/intake/${crypto.randomUUID()}-${sanitizeUploadFilename(basename(sourcePath))}`
  const fileStore = getFileStore()

  try {
    const upload = await fileStore.createDirectUpload({
      key,
      contentType: 'application/zip',
      byteSize: body.byteLength,
      sha256: digest,
      expiresInSeconds: 300,
    })
    const response = await fetch(upload.url, {
      method: 'PUT',
      headers: upload.headers,
      body,
    })
    if (!response.ok)
      throw new Error(
        `Direct upload returned ${response.status}: ${await response.text()}`,
      )

    const stored = await fileStore.get(key)
    if (stored.body.byteLength !== body.byteLength || stored.sha256 !== digest)
      throw new Error('Direct upload verification did not preserve the file')

    console.log(
      `Verified direct upload, SHA-256 retrieval, and cleanup for ${basename(sourcePath)} (${body.byteLength} bytes).`,
    )
  } finally {
    await fileStore.delete(key)
  }
}

main().catch((error) => {
  console.error('Direct upload verification failed:', error)
  process.exit(1)
})
