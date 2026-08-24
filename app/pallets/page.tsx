import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/domain/app-shell'
import { PalletService } from '@/lib/services/pallet'
import { db } from '@/db'
import { releases, productionJobs, panelMarks } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { PalletDashboardView } from '@/components/domain/pallets/pallet-dashboard-view'

export default async function PalletsPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const handleSignOut = async () => {
    'use server'
    await signOut({ redirectTo: '/sign-in' })
  }

  const userContext = {
    userId: session.user.id,
    email: session.user.email || '',
    roles: session.user.roles || [],
    isAdmin: session.user.isAdmin,
    organizationId: session.user.organizationId,
  }

  const initialPallets = await PalletService.getPallets(userContext)

  // Preload active releases
  const releaseRows = await db
    .select({
      id: releases.id,
      releaseNumber: releases.releaseNumber,
      jobNumber: productionJobs.jobNumber,
      jobName: productionJobs.name,
    })
    .from(releases)
    .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
    .where(
      eq(
        releases.organizationId,
        userContext.organizationId || '00000000-0000-0000-0000-000000000001',
      ),
    )
    .orderBy(desc(releases.createdAt))
    .limit(20)

  const availableReleases = releaseRows.map((r) => ({
    id: r.id,
    releaseKey: `${r.jobNumber}-R${r.releaseNumber}`,
    jobNumber: r.jobNumber,
  }))

  // Preload marks
  const markRows = await db
    .select({
      id: panelMarks.id,
      releaseId: releases.id,
      mark: panelMarks.mark,
      materialFamily: panelMarks.materialFamily,
      color: panelMarks.color,
      width: panelMarks.width,
      length: panelMarks.length,
      quantity: panelMarks.quantity,
    })
    .from(panelMarks)
    .innerJoin(releases, eq(panelMarks.releaseRevisionId, releases.id))
    .limit(50)

  const mappedMarks = markRows.map((m) => ({
    id: m.id,
    releaseId: m.releaseId,
    mark: m.mark,
    materialFamily: m.materialFamily,
    color: m.color,
    dimensions: m.width && m.length ? `${m.width}" × ${m.length}"` : null,
    quantity: m.quantity,
  }))

  const canManage =
    session.user.isAdmin ||
    session.user.roles.some((r) =>
      [
        'admin',
        'manager',
        'operations manager',
        'production manager',
        'shipping lead',
        'pallet builder/packager',
      ].includes(r.toLowerCase()),
    )

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
        <PalletDashboardView
          initialPallets={initialPallets}
          availableReleases={availableReleases}
          availableMarks={mappedMarks}
          canManage={canManage}
        />
      </div>
    </AppShell>
  )
}
