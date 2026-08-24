import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/domain/app-shell'
import { ScanStation } from '@/components/domain/scanner/scan-station'
import { db } from '@/db'
import { workstations, movementEvents, users } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { ensureSystemFoundationPopulated } from '@/lib/services/system-init'

export const metadata = {
  title: 'Scan Station | Elward Flow',
}

export default async function ScanPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const handleSignOut = async () => {
    'use server'
    await signOut({ redirectTo: '/sign-in' })
  }

  await ensureSystemFoundationPopulated(session.user.organizationId)

  // Load active workstations
  const stationList = await db
    .select({
      id: workstations.id,
      name: workstations.name,
      code: workstations.code,
      department: workstations.department,
    })
    .from(workstations)
    .where(eq(workstations.isActive, true))

  // Load initial movement history
  const recentMovements = await db
    .select({
      id: movementEvents.id,
      recordType: movementEvents.recordType,
      recordIdentifier: movementEvents.recordIdentifier,
      sourceStatus: movementEvents.sourceStatus,
      destinationStatus: movementEvents.destinationStatus,
      quantity: movementEvents.quantity,
      unit: movementEvents.unit,
      condition: movementEvents.condition,
      reason: movementEvents.reason,
      notes: movementEvents.notes,
      actorName: users.name,
      actingRole: movementEvents.actingRole,
      workstationName: workstations.name,
      timestamp: movementEvents.serverTimestamp,
    })
    .from(movementEvents)
    .leftJoin(users, eq(movementEvents.actorId, users.id))
    .leftJoin(workstations, eq(movementEvents.workstationId, workstations.id))
    .orderBy(desc(movementEvents.serverTimestamp))
    .limit(20)

  const formattedMovements = recentMovements.map((m) => ({
    id: m.id,
    recordType: m.recordType,
    recordIdentifier: m.recordIdentifier,
    sourceStatus: m.sourceStatus,
    destinationStatus: m.destinationStatus,
    quantity: m.quantity,
    unit: m.unit,
    condition: m.condition,
    reason: m.reason,
    notes: m.notes,
    actorName: m.actorName || 'Operator',
    actingRole: m.actingRole,
    workstationName: m.workstationName,
    timestamp: m.timestamp.toISOString(),
  }))

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
        <ScanStation
          workstations={stationList}
          initialMovements={formattedMovements}
          userRoles={session.user.roles || []}
          userName={session.user.name || session.user.email || 'Operator'}
        />
      </div>
    </AppShell>
  )
}
