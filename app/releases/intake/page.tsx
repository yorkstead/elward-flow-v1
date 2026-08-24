import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/domain/app-shell'
import { IntakeWizard } from './intake-wizard'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Release Intake & Document Control | Elward Flow',
}

export default async function ReleaseIntakePage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const handleSignOut = async () => {
    'use server'
    await signOut({ redirectTo: '/sign-in' })
  }

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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/releases">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-slate-600"
                >
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Releases
                </Button>
              </Link>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Release Intake & Revision Control
            </h1>
            <p className="text-xs text-slate-600">
              Upload release package, classify documents, review panel marks,
              and publish controlled shop floor packets.
            </p>
          </div>
        </div>

        <IntakeWizard
          userRoles={session.user.roles || []}
          isAdmin={session.user.isAdmin}
        />
      </div>
    </AppShell>
  )
}
