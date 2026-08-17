import { and, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { storedFiles } from '@/db/schema'
import { getFileStore } from '@/lib/files/minio-file-store'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user)
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const [record] = await db
    .select()
    .from(storedFiles)
    .where(
      and(
        eq(storedFiles.id, id),
        eq(storedFiles.organizationId, session.user.organizationId),
      ),
    )
    .limit(1)
  if (!record)
    return Response.json({ error: 'File not found' }, { status: 404 })
  const object = await getFileStore().get(record.objectKey)
  if (object.sha256 !== record.sha256)
    return Response.json(
      { error: 'File integrity verification failed' },
      { status: 500 },
    )
  return new Response(object.body as BodyInit, {
    headers: {
      'content-type': object.contentType,
      'content-disposition': `attachment; filename="${record.originalName.replaceAll('"', '')}"`,
      'x-content-sha256': object.sha256,
      'cache-control': 'private, no-store',
    },
  })
}
