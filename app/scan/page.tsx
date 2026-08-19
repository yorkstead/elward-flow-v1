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
import { QrCode, ScanLine, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface ScanPageProps {
  searchParams: Promise<{
    job?: string
    release?: string
    barcode?: string
  }>
}

export default async function ScanPage(props: ScanPageProps) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  const searchParams = await props.searchParams

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
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Shop Floor Scan Station
            </h1>
            <p className="text-xs text-slate-500">
              Scan release barcode, panel mark label, or pallet QR
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="text-xs">
              Back to Active Release
            </Button>
          </Link>
        </div>

        <Card className="border-2 border-dashed border-slate-300 bg-white shadow-xs">
          <CardHeader className="py-10 text-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
              <ScanLine className="h-8 w-8 animate-pulse" />
            </div>
            <CardTitle className="text-lg font-bold">
              Ready for Optical or Bluetooth Scan
            </CardTitle>
            <CardDescription className="mx-auto max-w-md text-xs text-slate-500">
              Scan any 2D DataMatrix or Code 128 barcode from traveling shop
              packets or panel face labels.
            </CardDescription>
          </CardHeader>
          <CardContent className="mx-auto max-w-md space-y-4 pb-8">
            {searchParams.barcode ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                <strong>Scanned Barcode:</strong> {searchParams.barcode}
              </div>
            ) : (
              <div className="flex gap-2">
                <Link
                  href="/dashboard?job=54120&release=1&mark=P-101"
                  className="w-full"
                >
                  <Button className="w-full bg-blue-600 text-xs font-semibold hover:bg-blue-700">
                    <QrCode className="mr-2 h-4 w-4" />
                    Simulate Scan: Mark P-101
                  </Button>
                </Link>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Obsolete revision scans will trigger a blocking warning and
                guide you to Rev 1 (A).
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
