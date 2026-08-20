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
    const { issueId, releaseReason, disposition, notes } = body

    if (!issueId || !releaseReason?.trim()) {
      return NextResponse.json(
        {
          error: 'Issue ID and Mandatory Release Reason are required.',
        },
        { status: 400 },
      )
    }

    const result = await QualityService.releaseQualityHold(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      {
        issueId,
        releaseReason: releaseReason.trim(),
        disposition: disposition || 'Pass with Note',
        notes,
      },
    )

    return NextResponse.json({ success: true, result })
  } catch (error) {
    logger.error('Release quality hold failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to release quality hold.',
      },
      { status: 500 },
    )
  }
}
