import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/domain/app-shell'
import { db } from '@/db'
import {
  purchaseOrderLines,
  purchaseOrders,
  inventoryItems,
  inventoryLocations,
  releases,
  productionJobs,
} from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { InventoryService } from '@/lib/services/inventory'
import { InventoryDashboardView } from '@/components/domain/inventory/inventory-dashboard-view'
import { ensureSystemFoundationPopulated } from '@/lib/services/system-init'

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const handleSignOut = async () => {
    'use server'
    await signOut({ redirectTo: '/sign-in' })
  }

  await ensureSystemFoundationPopulated(session.user.organizationId)

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

  // 2. Fetch Live Stock Summary
  const stockItems = await InventoryService.getStockSummary(context)

  // 3. Fetch Open PO Lines
  const poLinesData = await db
    .select({
      id: purchaseOrderLines.id,
      purchaseOrderId: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      vendorName: purchaseOrders.vendorName,
      lineNumber: purchaseOrderLines.lineNumber,
      itemNumber: inventoryItems.itemNumber,
      materialFamily: inventoryItems.materialFamily,
      description: purchaseOrderLines.description,
      orderedQuantity: purchaseOrderLines.orderedQuantity,
      receivedQuantity: purchaseOrderLines.receivedQuantity,
      unit: purchaseOrderLines.unit,
      status: purchaseOrderLines.status,
      expectedDate: purchaseOrders.expectedDate,
    })
    .from(purchaseOrderLines)
    .innerJoin(
      purchaseOrders,
      eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id),
    )
    .innerJoin(
      inventoryItems,
      eq(purchaseOrderLines.inventoryItemId, inventoryItems.id),
    )
    .orderBy(desc(purchaseOrders.orderDate), purchaseOrderLines.lineNumber)

  const poLines = poLinesData.map((p) => {
    const ordered = parseFloat(p.orderedQuantity)
    const received = parseFloat(p.receivedQuantity)
    return {
      id: p.id,
      purchaseOrderId: p.purchaseOrderId,
      poNumber: p.poNumber,
      vendorName: p.vendorName,
      lineNumber: p.lineNumber,
      itemNumber: p.itemNumber,
      materialFamily: p.materialFamily,
      description: p.description,
      orderedQuantity: ordered,
      receivedQuantity: received,
      remainingQuantity: Math.max(0, ordered - received),
      unit: p.unit,
      status: p.status,
      expectedDate: p.expectedDate
        ? new Date(p.expectedDate).toISOString().split('T')[0]
        : null,
    }
  })

  // 4. Fetch Release Demand
  const releaseDemand = activeReleaseId
    ? await InventoryService.getReleaseMaterialDemand(context, activeReleaseId)
    : []

  // 5. Fetch Locations
  const locations = await db
    .select({
      id: inventoryLocations.id,
      code: inventoryLocations.code,
      name: inventoryLocations.name,
      zone: inventoryLocations.zone,
    })
    .from(inventoryLocations)
    .where(eq(inventoryLocations.isActive, true))

  const canViewValuation =
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
        <InventoryDashboardView
          initialStock={stockItems}
          initialPoLines={poLines}
          initialReleaseDemand={releaseDemand}
          locations={locations}
          activeReleaseKey={activeReleaseKey}
          activeReleaseId={activeReleaseId}
          canViewValuation={canViewValuation}
        />
      </div>
    </AppShell>
  )
}
