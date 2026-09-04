import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  ScannerService,
  type ExecuteMovementInput,
} from '@/lib/services/scanner'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    if (!Array.isArray(body.items) || body.items.length > 100)
      return NextResponse.json(
        { error: 'Expected at most 100 movements.' },
        { status: 400 },
      )
    const items: ExecuteMovementInput[] = body.items

    const results = []

    for (const item of items) {
      try {
        const res = await ScannerService.executeMovement(
          {
            userId: session.user.id,
            email: session.user.email,
            roles: session.user.roles || [],
            isAdmin: session.user.isAdmin,
            organizationId: session.user.organizationId,
          },
          item,
        )
        results.push({
          idempotencyKey: item.idempotencyKey,
          success: true,
          result: res,
        })
      } catch (error) {
        logger.warn('Batch item execution error', {
          idempotencyKey: item.idempotencyKey,
          error: String(error),
        })
        results.push({
          idempotencyKey: item.idempotencyKey,
          success: false,
          error: error instanceof Error ? error.message : 'Execution error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: items.length,
      results,
    })
  } catch (error) {
    logger.error('Scanner batch sync failed', { error: String(error) })
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Batch sync failed.',
      },
      { status: 500 },
    )
  }
}
