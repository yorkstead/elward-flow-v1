import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/domain/app-shell'
import { ReportsService } from '@/lib/services/reports'
import { ReportsDashboardView } from '@/components/domain/reports/reports-dashboard-view'

export default async function ReportsPage() {
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

  const reportData = await ReportsService.getComprehensiveReport(userContext)

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
        <ReportsDashboardView initialReport={reportData} />
      </div>
    </AppShell>
  )
}
