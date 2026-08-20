'use client'

import * as React from 'react'
import {
  ShieldCheck,
  AlertOctagon,
  RotateCcw,
  BarChart3,
  Download,
  DollarSign,
  Lock,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InspectionLedgerTable } from './inspection-ledger-table'
import { QualityIssuesBoard } from './quality-issues-board'
import { RemakeManagementConsole } from './remake-management-console'
import { RootCauseAnalytics } from './root-cause-analytics'
import type {
  QualityInspectionItem,
  QualityIssueItem,
  RemakeItem,
} from '@/lib/services/quality'

interface MarkOption {
  id: string
  mark: string
  materialFamily: string
  color: string | null
}

interface QualityDashboardViewProps {
  initialInspections: QualityInspectionItem[]
  initialIssues: QualityIssueItem[]
  initialRemakes: RemakeItem[]
  marks: MarkOption[]
  activeReleaseKey: string
  activeReleaseId: string
  canViewCost?: boolean
}

export function QualityDashboardView({
  initialInspections,
  initialIssues,
  initialRemakes,
  marks,
  activeReleaseKey,
  activeReleaseId,
  canViewCost,
}: QualityDashboardViewProps) {
  const [activeTab, setActiveTab] = React.useState<
    'inspections' | 'issues' | 'remakes' | 'analytics'
  >('inspections')

  const activeHolds = initialIssues.filter(
    (i) => i.status !== 'Resolved' && i.disposition === 'Hold',
  ).length

  const openIssues = initialIssues.filter((i) => i.status !== 'Resolved').length

  const remakesInRouting = initialRemakes.filter(
    (r) => r.status === 'In Routing' || r.status === 'Pending',
  ).length

  const totalRemakeCost = initialRemakes.reduce(
    (acc, r) => acc + (r.totalCost || 0),
    0,
  )

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* Master Top Bar */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-950">
              Quality Assurance, Holds & RMK/RME Remakes
            </h1>
            <p className="text-xs text-slate-500">
              Inspection ledger, caliper tolerances, non-conformance holds, and
              remake cost trace for Release {activeReleaseKey}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tab Navigation */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <Button
              type="button"
              variant={activeTab === 'inspections' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('inspections')}
              className={`h-7 px-3 text-xs font-semibold ${
                activeTab === 'inspections'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600'
              }`}
            >
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Inspection Ledger
            </Button>
            <Button
              type="button"
              variant={activeTab === 'issues' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('issues')}
              className={`h-7 px-3 text-xs font-semibold ${
                activeTab === 'issues'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600'
              }`}
            >
              <AlertOctagon className="mr-1.5 h-3.5 w-3.5" />
              Holds & Issues ({activeHolds})
            </Button>
            <Button
              type="button"
              variant={activeTab === 'remakes' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('remakes')}
              className={`h-7 px-3 text-xs font-semibold ${
                activeTab === 'remakes'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600'
              }`}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              RMK / RME Remakes
            </Button>
            <Button
              type="button"
              variant={activeTab === 'analytics' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('analytics')}
              className={`h-7 px-3 text-xs font-semibold ${
                activeTab === 'analytics'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600'
              }`}
            >
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
              Defect Analytics
            </Button>
          </div>

          <a href="/api/quality/export" download>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold text-slate-800"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export QC CSV
            </Button>
          </a>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Quality KPI Summary Cards */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Active Quality Holds</span>
            <Lock className="h-4 w-4 text-red-600" />
          </div>
          <div
            className={`mt-2 text-2xl font-black ${
              activeHolds > 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            {activeHolds}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {activeHolds > 0 ? 'Blocking downstream flow' : 'No active holds'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Open Non-Conformances</span>
            <AlertOctagon className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-900">
            {openIssues}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Under containment & investigation
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Remakes in Routing</span>
            <Layers className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-purple-950">
            {remakesInRouting}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Sequence starting at 51
          </div>
        </div>

        {canViewCost && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold">Total Remake Cost</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-950">
              $
              {totalRemakeCost.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Material + Labor + Outside
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* Active Tab Content */}
      {/* ========================================================================= */}
      {activeTab === 'inspections' && (
        <InspectionLedgerTable
          initialInspections={initialInspections}
          marks={marks}
          releaseId={activeReleaseId}
        />
      )}

      {activeTab === 'issues' && (
        <QualityIssuesBoard initialIssues={initialIssues} />
      )}

      {activeTab === 'remakes' && (
        <RemakeManagementConsole
          initialRemakes={initialRemakes}
          marks={marks}
          canViewCost={canViewCost}
        />
      )}

      {activeTab === 'analytics' && (
        <RootCauseAnalytics issues={initialIssues} />
      )}
    </div>
  )
}
