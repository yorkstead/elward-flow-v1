import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ProductionService } from '@/lib/services/production'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const downtimes = await ProductionService.getActiveDowntimes({
      userId: session.user.id,
      email: session.user.email,
      roles: session.user.roles || [],
      isAdmin: session.user.isAdmin,
    })

    return NextResponse.json({ success: true, downtimes })
  } catch (error) {
    logger.error('Failed to get active downtimes', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to fetch downtimes.',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workstationId, department, category, reason, notes } = body

    if (!department || !category || !reason) {
      return NextResponse.json(
        { error: 'Department, category, and reason are required.' },
        { status: 400 },
      )
    }

    const result = await ProductionService.logDowntime(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      {
        workstationId,
        department,
        category,
        reason,
        notes,
      },
    )

    return NextResponse.json({ success: true, result })
  } catch (error) {
    logger.error('Logging downtime failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to log downtime.',
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { downtimeId, notes } = body

    if (!downtimeId) {
      return NextResponse.json(
        { error: 'Downtime ID is required for resolution.' },
        { status: 400 },
      )
    }

    const result = await ProductionService.resolveDowntime(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      {
        downtimeId,
        notes,
      },
    )

    return NextResponse.json({ success: true, result })
  } catch (error) {
    logger.error('Resolving downtime failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to resolve downtime.',
      },
      { status: 500 },
    )
  }
}
