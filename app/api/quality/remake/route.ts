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
      originalPanelMarkId,
      remakeType,
      qualityIssueId,
      responsibleArea,
      startingSequence,
      materialCost,
      laborHours,
      laborCost,
      outsideCost,
      notes,
    } = body

    if (!originalPanelMarkId || !remakeType || !responsibleArea) {
      return NextResponse.json(
        {
          error:
            'Original Panel Mark ID, Remake Type (RMK/RME), and Responsible Area are required.',
        },
        { status: 400 },
      )
    }

    const result = await QualityService.generateRemake(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      {
        originalPanelMarkId,
        remakeType,
        qualityIssueId,
        responsibleArea,
        startingSequence: startingSequence
          ? parseInt(startingSequence, 10)
          : 51,
        materialCost: materialCost ? parseFloat(materialCost) : undefined,
        laborHours: laborHours ? parseFloat(laborHours) : undefined,
        laborCost: laborCost ? parseFloat(laborCost) : undefined,
        outsideCost: outsideCost ? parseFloat(outsideCost) : undefined,
        notes,
      },
    )

    return NextResponse.json({ success: true, result })
  } catch (error) {
    logger.error('Remake generation failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate remake.',
      },
      { status: 500 },
    )
  }
}
