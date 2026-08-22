import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/domain/app-shell'
import { AdminService } from '@/lib/services/admin'
import { AdminDashboardView } from '@/components/domain/admin/admin-dashboard-view'

export default async function AdminPage() {
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

  const [users, roles, configs, auditLogs] = await Promise.all([
    AdminService.getUsers(userContext),
    AdminService.getRoles(userContext),
    AdminService.getSystemConfigs(userContext),
    AdminService.getAuditLedger(userContext, { limit: 100 }),
  ])

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
        <AdminDashboardView
          initialUsers={users}
          initialRoles={roles}
          initialConfigs={configs}
          initialAuditLogs={auditLogs}
          isAdmin={Boolean(session.user.isAdmin)}
        />
      </div>
    </AppShell>
  )
}
