import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/domain/app-shell'
import { ShippingService } from '@/lib/services/shipping'
import { PalletService } from '@/lib/services/pallet'
import { ShippingDashboardView } from '@/components/domain/shipping/shipping-dashboard-view'
import { ensureSystemFoundationPopulated } from '@/lib/services/system-init'

export const metadata = {
  title: 'Shipping Logistics & BOL | Ellwood Flow',
}

export default async function ShippingPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const handleSignOut = async () => {
    'use server'
    await signOut({ redirectTo: '/sign-in' })
  }

  await ensureSystemFoundationPopulated(session.user.organizationId)

  const userContext = {
    userId: session.user.id,
    email: session.user.email || '',
    roles: session.user.roles || [],
    isAdmin: session.user.isAdmin,
    organizationId: session.user.organizationId,
  }

  const initialShipments = await ShippingService.getShipments(userContext)
  const allPallets = await PalletService.getPallets(userContext)
  const stagedPallets = allPallets.filter(
    (p) => p.status === 'Staged' || p.status === 'Building',
  )

  const canManage =
    session.user.isAdmin ||
    session.user.roles.some((r) =>
      [
        'admin',
        'manager',
        'operations manager',
        'production manager',
        'shipping lead',
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
        <ShippingDashboardView
          initialShipments={initialShipments}
          stagedPallets={stagedPallets}
          canManage={canManage}
        />
      </div>
    </AppShell>
  )
}
