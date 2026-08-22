import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { DomainService } from '@/lib/services/domain'
import { getFileStore } from '@/lib/files/minio-file-store'
import {
  DIRECT_UPLOAD_EXPIRY_SECONDS,
  isAllowedIntakeFile,
  MAX_INTAKE_BYTES,
  sanitizeUploadFilename,
} from '@/lib/intake-upload'
import { logger } from '@/lib/logger'

const uploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().max(255),
  byteSize: z.number().int().positive().max(MAX_INTAKE_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
})

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!session.user.organizationId)
      return NextResponse.json(
        { error: 'Authenticated user has no organization.' },
        { status: 403 },
      )
    if (
      !DomainService.hasPermission(
        session.user.roles || [],
        'create',
        session.user.isAdmin,
      )
    )
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const parsed = uploadRequestSchema.safeParse(await request.json())
    if (!parsed.success)
      return NextResponse.json(
        { error: 'Upload metadata is invalid or the package exceeds 100 MB.' },
        { status: 400 },
      )
    if (!isAllowedIntakeFile(parsed.data.filename, parsed.data.contentType))
      return NextResponse.json(
        { error: 'Release package must be a ZIP archive or PDF.' },
        { status: 400 },
      )

    const stagingKey = `staging/${session.user.organizationId}/${session.user.id}/intake/${crypto.randomUUID()}-${sanitizeUploadFilename(parsed.data.filename)}`
    const upload = await getFileStore().createDirectUpload({
      key: stagingKey,
      contentType: parsed.data.contentType || 'application/octet-stream',
      byteSize: parsed.data.byteSize,
      sha256: parsed.data.sha256,
      expiresInSeconds: DIRECT_UPLOAD_EXPIRY_SECONDS,
    })

    return NextResponse.json({
      stagingKey,
      uploadUrl: upload.url,
      uploadHeaders: upload.headers,
      expiresInSeconds: DIRECT_UPLOAD_EXPIRY_SECONDS,
    })
  } catch (error) {
    logger.error('Direct release upload authorization failed', {
      error: String(error),
    })
    return NextResponse.json(
      { error: 'Could not authorize secure storage upload.' },
      { status: 400 },
    )
  }
}
