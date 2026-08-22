import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { IntakeService } from '@/lib/services/intake'
import { logger } from '@/lib/logger'
import { DomainService } from '@/lib/services/domain'

const MAX_INTAKE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
])

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const manualJobNumber = String(formData.get('jobNumber') ?? '').trim()
    const manualReleaseNumber = Number(formData.get('releaseNumber'))
    const manualMaterialFamily = String(
      formData.get('materialFamily') ?? '',
    ).trim()

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No package file provided.' },
        { status: 400 },
      )
    }
    if (file.size < 1 || file.size > MAX_INTAKE_BYTES) {
      return NextResponse.json(
        { error: 'Release package must be between 1 byte and 10 MB.' },
        { status: 413 },
      )
    }
    const lowerName = file.name.toLowerCase()
    if (
      (!lowerName.endsWith('.zip') && !lowerName.endsWith('.pdf')) ||
      (file.type && !ALLOWED_TYPES.has(file.type))
    ) {
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

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

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
      filename: file.name,
      buffer,
      contentType: file.type || 'application/octet-stream',
      manualJobNumber,
      manualReleaseNumber: manualReleaseNumber,
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
  }
}
