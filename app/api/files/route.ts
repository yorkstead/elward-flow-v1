import { randomUUID } from 'node:crypto'
import { auth } from '@/auth'
import { db } from '@/db'
import { storedFiles } from '@/db/schema'
import { getFileStore } from '@/lib/files/minio-file-store'
import { sha256 } from '@/lib/files/hash'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user)
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File))
    return Response.json({ error: 'A file is required' }, { status: 400 })
  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES)
    return Response.json(
      { error: 'File must be between 1 byte and 10 MB' },
      { status: 400 },
    )
  if (file.type !== 'application/pdf')
    return Response.json(
      { error: 'The foundation test accepts PDF files only' },
      { status: 400 },
    )
  const bytes = new Uint8Array(await file.arrayBuffer())
  const digest = sha256(bytes)
  const key = `originals/${session.user.organizationId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.pdf`
  const object = await getFileStore().putImmutable({
    key,
    body: bytes,
    contentType: file.type,
    expectedSha256: digest,
  })
  const [record] = await db
    .insert(storedFiles)
    .values({
      organizationId: session.user.organizationId,
      objectKey: object.key,
      originalName: file.name,
      contentType: object.contentType,
      byteSize: object.byteSize,
      sha256: object.sha256,
      uploadedById: session.user.id,
    })
    .returning()
  return Response.json(
    {
      id: record.id,
      name: record.originalName,
      sha256: record.sha256,
      downloadUrl: `/api/files/${record.id}`,
    },
    { status: 201 },
  )
}
