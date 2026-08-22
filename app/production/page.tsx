import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/domain/app-shell'
import { ProductionScheduleView } from '@/components/domain/production/production-schedule-view'
import { ProductionService } from '@/lib/services/production'
import { db } from '@/db'
import { workstations } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const metadata = {
  title: 'Production Schedule & Planning | Elward Flow',
}

export default async function ProductionPage() {
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

  // Preload department capacity metrics
  const capacity = await ProductionService.getDepartmentCapacity(context)

  // Preload active shop queue
  const queue = await ProductionService.getDepartmentQueue(context)

  // Preload active machine downtime events
  const downtimes = await ProductionService.getActiveDowntimes(context)

  // Preload workstations
  const wsList = await db
    .select({
      id: workstations.id,
      name: workstations.name,
      code: workstations.code,
      department: workstations.department,
    })
    .from(workstations)
    .where(eq(workstations.isActive, true))

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
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <ProductionScheduleView
          initialCapacity={capacity}
          initialQueue={queue}
          initialDowntimes={downtimes.map((d) => ({
            ...d,
            startedAt: d.startedAt.toISOString(),
          }))}
          workstations={wsList}
        />
      </div>
    </AppShell>
  )
}
