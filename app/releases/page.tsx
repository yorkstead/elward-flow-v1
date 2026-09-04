import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/domain/app-shell'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { db } from '@/db'
import {
  releases,
  productionJobs,
  releaseRevisions,
  customers,
} from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { Upload, FileDown, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Production Releases | Ellwood Flow',
}

export const dynamic = 'force-dynamic'

export default async function ReleasesPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const handleSignOut = async () => {
    'use server'
    await signOut({ redirectTo: '/sign-in' })
  }

  // Fetch all releases with jobs, active revisions, and mark counts
  let releaseList: {
    releaseId: string
    releaseNumber: number
    status: string
    priority: number
    requiredDate: Date | null
    jobNumber: string
    jobName: string
    customerName: string | null
    revisionId: string | null
    revisionNumber: number | null
    revisionLabel: string | null
    revisionStatus: string | null
    isCurrent: boolean | null
  }[] = []

  try {
    let orgId = session.user.organizationId
    if (!orgId || orgId === 'undefined') {
      const [firstOrg] = await db.select().from(productionJobs).limit(1)
      if (firstOrg) orgId = firstOrg.organizationId
    }

    const targetOrgId = orgId || '00000000-0000-0000-0000-000000000001'
    releaseList = await db
      .select({
        releaseId: releases.id,
        releaseNumber: releases.releaseNumber,
        status: releases.status,
        priority: releases.priority,
        requiredDate: releases.requiredDate,
        jobNumber: productionJobs.jobNumber,
        jobName: productionJobs.name,
        customerName: customers.name,
        revisionId: releaseRevisions.id,
        revisionNumber: releaseRevisions.revisionNumber,
        revisionLabel: releaseRevisions.revisionLabel,
        revisionStatus: releaseRevisions.status,
        isCurrent: releaseRevisions.isCurrent,
      })
      .from(releases)
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .leftJoin(customers, eq(productionJobs.customerId, customers.id))
      .leftJoin(
        releaseRevisions,
        and(
          eq(releases.id, releaseRevisions.releaseId),
          eq(releaseRevisions.isCurrent, true),
        ),
      )
      .where(eq(releases.organizationId, targetOrgId))
      .orderBy(desc(releases.updatedAt))
  } catch (err) {
    console.error('Failed to load release list:', err)
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
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Production Releases Master
            </h1>
            <p className="text-xs text-slate-600">
              Release intake, revision history, controlled packets, and shop
              routing
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/releases/intake"
              className={buttonVariants({
                className:
                  'bg-blue-600 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700',
              })}
            >
              <Upload className="mr-2 h-4 w-4" /> New Release Intake
            </Link>
          </div>
        </div>

        {/* Releases Directory Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <h2 className="text-sm font-bold text-slate-950">
              Active & Controlled Releases ({releaseList.length})
            </h2>
            <p className="text-xs text-slate-600">
              All releases are uniquely keyed by Job + Release with unmistakable
              current revision tracking.
            </p>
          </div>

          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Releases Directory Table"
          >
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-4 py-3">Business Key</th>
                  <th className="px-4 py-3">Project & Customer</th>
                  <th className="px-4 py-3 text-center">Current Revision</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Target Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {releaseList.map((row) => (
                  <tr
                    key={row.releaseId}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-slate-950">
                          {row.jobNumber}-{row.releaseNumber}
                        </span>
                        {row.priority > 0 && (
                          <Badge
                            variant="outline"
                            className="border-purple-200 text-[10px] text-purple-700"
                          >
                            P{row.priority}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-600">
                        Job {row.jobNumber} • Rel {row.releaseNumber}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-950">{row.jobName}</p>
                      <p className="text-[11px] text-slate-600">
                        {row.customerName}
                      </p>
                    </td>

                    <td className="px-4 py-3 text-center">
                      {row.revisionLabel ? (
                        <Badge className="bg-emerald-700 font-mono text-[11px] font-bold text-white">
                          Rev {row.revisionNumber} ({row.revisionLabel})
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[11px] text-slate-500"
                        >
                          Draft
                        </Badge>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <Badge
                        className={`text-[11px] font-semibold text-white ${
                          row.status === 'Approved for production' ||
                          row.status === 'In production'
                            ? 'bg-blue-700'
                            : row.status === 'QC hold' ||
                                row.status === 'Material hold'
                              ? 'bg-amber-700'
                              : 'bg-slate-700'
                        }`}
                      >
                        {row.status}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 font-mono text-[11px] text-slate-700">
                      {row.requiredDate
                        ? new Date(row.requiredDate).toLocaleDateString(
                            'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            },
                          )
                        : '—'}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/api/releases/${row.releaseId}/packets/complete?format=pdf`}
                          target="_blank"
                          rel="noreferrer"
                          title="Download Merged Controlled PDF Packet"
                          className={buttonVariants({
                            variant: 'outline',
                            size: 'sm',
                            className: 'h-8 px-2 text-xs',
                          })}
                        >
                          <FileDown className="mr-1 h-3.5 w-3.5" /> PDF Packet
                        </a>
                        <Link
                          href={`/dashboard?job=${row.jobNumber}&release=${row.releaseNumber}`}
                          className={buttonVariants({
                            size: 'sm',
                            className:
                              'h-8 bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700',
                          })}
                        >
                          Command Center{' '}
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}

                {releaseList.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-600"
                    >
                      No production releases registered yet. Click &quot;New
                      Release Intake&quot; to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
