import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { workstations, sites } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stations = await db
      .select({
        id: workstations.id,
        name: workstations.name,
        code: workstations.code,
        department: workstations.department,
        isActive: workstations.isActive,
      })
      .from(workstations)
      .innerJoin(sites, eq(workstations.siteId, sites.id))
      .where(
        and(
          eq(workstations.isActive, true),
          eq(sites.organizationId, session.user.organizationId),
        ),
      )

    return NextResponse.json({
      success: true,
      workstations: stations,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch workstations.',
      },
      { status: 500 },
    )
  }
}
