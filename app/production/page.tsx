import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/domain/app-shell'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function ProductionPage() {
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
      siteName="Fictional Primary Plant"
      timezone="America/Denver"
      onSignOut={handleSignOut}
    >
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Shop Floor Production
            </h1>
            <p className="text-xs text-slate-500">
              CNC routing, ELU cuts, parts prep, and assembly work stations
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="text-xs">
              Back to Active Release
            </Button>
          </Link>
        </div>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              Operational Context
            </CardTitle>
            <CardDescription className="text-xs">
              Currently driving Job 54120 • Release 1 (Tempe Gateway Commercial
              Center Phase II).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <span>
                Station operations are integrated with the active pinned
                release.
              </span>
              <Link href="/dashboard?job=54120&release=1">
                <Button
                  size="sm"
                  className="bg-blue-600 text-xs font-semibold hover:bg-blue-700"
                >
                  Open Command Center
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
