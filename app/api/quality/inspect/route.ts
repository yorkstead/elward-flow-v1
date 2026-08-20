import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { QualityService } from '@/lib/services/quality'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      releaseId,
      panelMarkId,
      operationInstanceId,
      quantity,
      disposition,
      specificationVersion,
      measurements,
      notes,
      destination,
      issueCategory,
      issueSeverity,
      suspectedCause,
      responsibleDepartment,
      reworkToOperationId,
    } = body

    if (!releaseId || !panelMarkId || !quantity || !disposition) {
      return NextResponse.json(
        {
          error:
            'Release ID, Panel Mark ID, Quantity, and Disposition are required.',
        },
        { status: 400 },
      )
    }

    const result = await QualityService.recordInspection(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      {
        releaseId,
        panelMarkId,
        operationInstanceId,
        quantity: parseInt(quantity, 10),
        disposition,
        specificationVersion,
        measurements,
        notes,
        destination,
        issueCategory,
        issueSeverity,
        suspectedCause,
        responsibleDepartment,
        reworkToOperationId,
      },
    )

    return NextResponse.json({ success: true, result })
  } catch (error) {
    logger.error('QC inspection record failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to record QC inspection.',
      },
      { status: 500 },
    )
  }
}
