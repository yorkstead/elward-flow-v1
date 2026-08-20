'use client'

import * as React from 'react'
import {
  BarChart3,
  TrendingDown,
  Wrench,
  Cpu,
  Layers,
  Truck,
  FileSpreadsheet,
} from 'lucide-react'
import type { QualityIssueItem } from '@/lib/services/quality'

interface RootCauseAnalyticsProps {
  issues: QualityIssueItem[]
}

export function RootCauseAnalytics({ issues }: RootCauseAnalyticsProps) {
  const deptCounts: Record<string, number> = {
    Assembly: 0,
    CNC: 0,
    ELU: 0,
    Engineering: 0,
    'Material/Vendor': 0,
    Shipping: 0,
  }

  const categoryCounts: Record<string, number> = {
    'Surface Defect': 0,
    'Dimensional Discrepancy': 0,
    'Bending/Routing Error': 0,
    'Hardware/Assembly Defect': 0,
    'Material Flaw': 0,
    'Handling Damage': 0,
  }

  for (const issue of issues) {
    if (deptCounts[issue.responsibleDepartment] !== undefined) {
      deptCounts[issue.responsibleDepartment]++
    } else {
      deptCounts[issue.responsibleDepartment] = 1
    }

    if (categoryCounts[issue.category] !== undefined) {
      categoryCounts[issue.category]++
    } else {
      categoryCounts[issue.category] = 1
    }
  }

  const totalIssues = Math.max(1, issues.length)

  const getDeptIcon = (dept: string) => {
    switch (dept) {
      case 'CNC':
        return <Cpu className="h-4 w-4 text-blue-600" />
      case 'ELU':
        return <Wrench className="h-4 w-4 text-purple-600" />
      case 'Assembly':
        return <Layers className="h-4 w-4 text-emerald-600" />
      case 'Engineering':
        return <FileSpreadsheet className="h-4 w-4 text-amber-600" />
      case 'Shipping':
        return <Truck className="h-4 w-4 text-indigo-600" />
      default:
        return <Wrench className="h-4 w-4 text-slate-600" />
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Department Breakdown */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Non-Conformance by Department
            </h3>
            <p className="text-xs text-slate-500">
              Defect origin distribution across shop stations and engineering
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {Object.entries(deptCounts).map(([dept, count]) => {
            const pct = Math.round((count / totalIssues) * 100)
            return (
              <div key={dept} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    {getDeptIcon(dept)}
                    <span className="text-slate-800">{dept}</span>
                  </div>
                  <span className="font-mono text-slate-900">
                    {count} ({pct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recurring Category Breakdown */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <TrendingDown className="h-5 w-5 text-amber-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Recurring Defect Categories
            </h3>
            <p className="text-xs text-slate-500">
              Root-cause failure mode frequency analysis
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {Object.entries(categoryCounts).map(([category, count]) => {
            const pct = Math.round((count / totalIssues) * 100)
            return (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-800">{category}</span>
                  <span className="font-mono text-slate-900">
                    {count} ({pct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
