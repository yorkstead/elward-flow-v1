import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { organizations } from '@/db/schema'
import { IntakeService } from '@/lib/services/intake'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const manualJobNumber = formData.get('jobNumber') as string | undefined
    const manualReleaseNumber = formData.get('releaseNumber')
      ? parseInt(formData.get('releaseNumber') as string, 10)
      : undefined
    const manualMaterialFamily = formData.get('materialFamily') as
      string | undefined

    if (!file) {
      return NextResponse.json(
        { error: 'No package file provided.' },
        { status: 400 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const [org] = await db.select().from(organizations).limit(1)
    if (!org) {
      return NextResponse.json(
        { error: 'No active organization found.' },
        { status: 500 },
      )
    }

    const intakeResult = await IntakeService.processUploadPackage({
      organizationId: org.id,
      uploadedById: session.user.id,
      filename: file.name,
      buffer,
      contentType: file.type || 'application/octet-stream',
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
  }
}
