import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/domain/app-shell'
import { db } from '@/db'
import { panelMarks, releases, productionJobs } from '@/db/schema'
import { eq } from 'drizzle-orm'
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

  // 1. Fetch default Release 54120-1
  const [targetRelease] = await db
    .select({
      id: releases.id,
      releaseNumber: releases.releaseNumber,
      jobNumber: productionJobs.jobNumber,
    })
    .from(releases)
    .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
    .where(eq(productionJobs.jobNumber, '54120'))
    .limit(1)

  const activeReleaseId = targetRelease?.id || ''
  const activeReleaseKey = targetRelease
    ? `${targetRelease.jobNumber}-${targetRelease.releaseNumber}`
    : '54120-1'

  // 2. Fetch Live Inspections
  const inspections = await QualityService.getInspections(context)

  // 3. Fetch Open Issues & Holds
  const issues = await QualityService.getIssues(context)

  // 4. Fetch Remakes & Cost Traces
  const remakes = await QualityService.getRemakes(context)

  // 5. Fetch Marks for Release
  const marks = await db
    .select({
      id: panelMarks.id,
      mark: panelMarks.mark,
      materialFamily: panelMarks.materialFamily,
      color: panelMarks.color,
    })
    .from(panelMarks)
    .where(
      eq(panelMarks.organizationId, targetRelease?.id ? targetRelease.id : ''),
    )

  // Fallback query if marks query by orgId
  const allMarks = await db
    .select({
      id: panelMarks.id,
      mark: panelMarks.mark,
      materialFamily: panelMarks.materialFamily,
      color: panelMarks.color,
    })
    .from(panelMarks)
    .limit(20)

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
      siteName="Fictional Primary Plant"
      timezone="America/Denver"
      onSignOut={handleSignOut}
    >
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <QualityDashboardView
          initialInspections={inspections}
          initialIssues={issues}
          initialRemakes={remakes}
          marks={marks.length > 0 ? marks : allMarks}
          activeReleaseKey={activeReleaseKey}
          activeReleaseId={activeReleaseId}
          canViewCost={canViewCost}
        />
      </div>
    </AppShell>
  )
}
