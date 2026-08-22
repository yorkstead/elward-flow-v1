import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { sites } from '@/db/schema'
import { RevisionControlService } from '@/lib/services/revision'
import { logger } from '@/lib/logger'
import { and, eq } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const {
      jobNumber,
      releaseNumber,
      revisionLabel = 'A',
      materialFamily = 'ACM',
      customerName,
      projectName,
      reviewSummary = 'Approved for shop floor production',
      marks = [],
      files = [],
      impactDispositions = [],
    } = body

    if (!session.user.organizationId) {
      return NextResponse.json(
        { error: 'Authenticated user has no organization.' },
        { status: 403 },
      )
    }

    const [site] = await db
      .select()
      .from(sites)
      .where(
        and(
          eq(sites.organizationId, session.user.organizationId),
          eq(sites.isProductionFacility, true),
        ),
      )
      .limit(1)

    if (!site) {
      return NextResponse.json(
        { error: 'No production facility is configured.' },
        { status: 409 },
      )
    }

    const result = await RevisionControlService.publishRevision(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      {
        organizationId: session.user.organizationId,
        siteId: site.id,
        jobNumber,
        releaseNumber: parseInt(releaseNumber, 10) || 1,
        revisionLabel,
        materialFamily,
        customerName,
        projectName,
        reviewSummary,
        marks,
        files,
        impactDispositions,
      },
    )

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    logger.error('Revision publish failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Revision publishing failed.',
      },
      { status: 400 },
    )
  }
}
