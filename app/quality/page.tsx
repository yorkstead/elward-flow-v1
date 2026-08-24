import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/domain/app-shell'
import { db } from '@/db'
import {
  panelMarks,
  releases,
  productionJobs,
  releaseRevisions,
} from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { QualityService } from '@/lib/services/quality'
import { QualityDashboardView } from '@/components/domain/quality/quality-dashboard-view'

export default async function QualityPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const handleSignOut = async () => {
    'use server'
    await signOut({ redirectTo: '/sign-in' })
  }

  const context = {
    userId: session.user.id,
    email: session.user.email || 'admin@example.test',
    roles: session.user.roles || [],
    isAdmin: session.user.isAdmin,
  }

  // 1. Fetch default Release (Job 25036 or first available release)
  let [targetRelease] = await db
    .select({
      id: releases.id,
      releaseNumber: releases.releaseNumber,
      jobNumber: productionJobs.jobNumber,
    })
    .from(releases)
    .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
    .where(eq(productionJobs.jobNumber, '25036'))
    .limit(1)

  if (!targetRelease) {
    const [firstRel] = await db
      .select({
        id: releases.id,
        releaseNumber: releases.releaseNumber,
        jobNumber: productionJobs.jobNumber,
      })
      .from(releases)
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .orderBy(desc(releases.createdAt))
      .limit(1)
    targetRelease = firstRel
  }

  const activeReleaseId = targetRelease?.id || ''
  const activeReleaseKey = targetRelease
    ? `${targetRelease.jobNumber}-${targetRelease.releaseNumber}`
    : '25036-1'

  // 2. Fetch Live Inspections
  const inspections = await QualityService.getInspections(context)

  // 3. Fetch Open Issues & Holds
  const issues = await QualityService.getIssues(context)

  // 4. Fetch Remakes & Cost Traces
  const remakes = await QualityService.getRemakes(context)

  // 5. Fetch Marks for Release
  let marks: Array<{
    id: string
    mark: string
    materialFamily: string
    color: string | null
  }> = []

  if (targetRelease?.id) {
    marks = await db
      .select({
        id: panelMarks.id,
        mark: panelMarks.mark,
        materialFamily: panelMarks.materialFamily,
        color: panelMarks.color,
      })
      .from(panelMarks)
      .innerJoin(
        releaseRevisions,
        eq(panelMarks.releaseRevisionId, releaseRevisions.id),
      )
      .where(
        and(
          eq(releaseRevisions.releaseId, targetRelease.id),
          eq(releaseRevisions.isCurrent, true),
        ),
      )
  }

  if (marks.length === 0) {
    marks = await db
      .select({
        id: panelMarks.id,
        mark: panelMarks.mark,
        materialFamily: panelMarks.materialFamily,
        color: panelMarks.color,
      })
      .from(panelMarks)
      .limit(50)
  }

  const canViewCost =
    session.user.isAdmin ||
    session.user.roles?.includes('Operations Manager') ||
    session.user.roles?.includes('System Administrator')

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        isAdmin: session.user.isAdmin,
        roles: session.user.roles,
      }}
      siteName="Shop"
      timezone="America/Denver"
      onSignOut={handleSignOut}
    >
      <div className="mx-auto w-full max-w-[1920px] space-y-6 p-4 sm:p-6 lg:p-8">
        <QualityDashboardView
          initialInspections={inspections}
          initialIssues={issues}
          initialRemakes={remakes}
          marks={marks}
          activeReleaseKey={activeReleaseKey}
          activeReleaseId={activeReleaseId}
          canViewCost={canViewCost}
        />
      </div>
    </AppShell>
  )
}
