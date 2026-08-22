import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { IntakeService } from '@/lib/services/intake'
import { logger } from '@/lib/logger'
import { DomainService } from '@/lib/services/domain'
import { getFileStore } from '@/lib/files/minio-file-store'
import { isAllowedIntakeFile, MAX_INTAKE_BYTES } from '@/lib/intake-upload'
import { z } from 'zod'

const directIntakeSchema = z.object({
  stagingKey: z.string().min(1),
  filename: z.string().min(1).max(255),
  contentType: z.string().max(255),
  byteSize: z.number().int().positive().max(MAX_INTAKE_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  jobNumber: z.string(),
  releaseNumber: z.number(),
  materialFamily: z.string(),
})

export async function POST(request: Request) {
  let stagingKeyToClean: string | undefined
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let filename: string
    let contentType: string
    let buffer: Buffer
    let manualJobNumber: string
    let manualReleaseNumber: number
    let manualMaterialFamily: string

    if (request.headers.get('content-type')?.includes('application/json')) {
      const parsed = directIntakeSchema.safeParse(await request.json())
      if (!parsed.success)
        return NextResponse.json(
          { error: 'Direct upload reference is invalid.' },
          { status: 400 },
        )
      if (!session.user.organizationId)
        return NextResponse.json(
          { error: 'Authenticated user has no organization.' },
          { status: 403 },
        )

      const expectedPrefix = `staging/${session.user.organizationId}/${session.user.id}/intake/`
      if (!parsed.data.stagingKey.startsWith(expectedPrefix))
        return NextResponse.json(
          { error: 'Direct upload does not belong to this user.' },
          { status: 403 },
        )

      stagingKeyToClean = parsed.data.stagingKey
      const staged = await getFileStore().get(parsed.data.stagingKey)
      if (
        staged.body.byteLength !== parsed.data.byteSize ||
        staged.sha256 !== parsed.data.sha256
      )
        return NextResponse.json(
          { error: 'Uploaded package failed size or SHA-256 verification.' },
          { status: 400 },
        )

      filename = parsed.data.filename
      contentType = parsed.data.contentType || staged.contentType
      buffer = Buffer.from(staged.body)
      manualJobNumber = parsed.data.jobNumber.trim()
      manualReleaseNumber = parsed.data.releaseNumber
      manualMaterialFamily = parsed.data.materialFamily.trim()
    } else {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!(file instanceof File))
        return NextResponse.json(
          { error: 'No package file provided.' },
          { status: 400 },
        )
      if (file.size < 1 || file.size > MAX_INTAKE_BYTES)
        return NextResponse.json(
          { error: 'Release package must be between 1 byte and 100 MB.' },
          { status: 413 },
        )

      filename = file.name
      contentType = file.type || 'application/octet-stream'
      buffer = Buffer.from(await file.arrayBuffer())
      manualJobNumber = String(formData.get('jobNumber') ?? '').trim()
      manualReleaseNumber = Number(formData.get('releaseNumber'))
      manualMaterialFamily = String(formData.get('materialFamily') ?? '').trim()
    }

    if (!isAllowedIntakeFile(filename, contentType)) {
      return NextResponse.json(
        { error: 'Release package must be a ZIP archive or PDF.' },
        { status: 400 },
      )
    }
    if (!DomainService.validateJobNumber(manualJobNumber)) {
      return NextResponse.json(
        { error: 'Job number must be exactly five digits.' },
        { status: 400 },
      )
    }
    if (!Number.isInteger(manualReleaseNumber) || manualReleaseNumber < 1) {
      return NextResponse.json(
        { error: 'Release number must be a positive integer.' },
        { status: 400 },
      )
    }
    if (
      !DomainService.hasPermission(
        session.user.roles || [],
        'create',
        session.user.isAdmin,
      )
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!session.user.organizationId) {
      return NextResponse.json(
        { error: 'Authenticated user has no organization.' },
        { status: 403 },
      )
    }

    const intakeResult = await IntakeService.processUploadPackage({
      organizationId: session.user.organizationId,
      uploadedById: session.user.id,
      actingRole: session.user.roles?.[0] || 'Authenticated User',
      filename,
      buffer,
      contentType,
      manualJobNumber,
      manualReleaseNumber,
      manualMaterialFamily,
    })

    return NextResponse.json({
      success: true,
      intake: intakeResult,
    })
  } catch (error) {
    logger.error('Release intake processing failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Release intake failed.',
      },
      { status: 400 },
    )
  } finally {
    if (stagingKeyToClean) {
      try {
        await getFileStore().delete(stagingKeyToClean)
      } catch (cleanupError) {
        logger.warn('Staged release upload cleanup failed', {
          stagingKey: stagingKeyToClean,
          error: String(cleanupError),
        })
      }
    }
  }
}
