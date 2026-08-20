'use client'

import React, { useState } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp,
  FileSpreadsheet,
  AlertOctagon,
  Truck,
  Boxes,
} from 'lucide-react'
import { ComprehensiveReportData } from '@/lib/services/reports'

interface ReportsDashboardProps {
  initialReport: ComprehensiveReportData
}

export function ReportsDashboardView({ initialReport }: ReportsDashboardProps) {
  const [report, setReport] = useState<ComprehensiveReportData>(initialReport)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const res = await fetch('/api/reports')
      if (res.ok) {
        const data = (await res.json()) as { report: ComprehensiveReportData }
        setReport(data.report)
      }
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Operational Manufacturing Reports &amp; Yield Analytics
          </h1>
          <p className="text-xs text-slate-500">
            Real-time throughput metrics, department station efficiency, and
            defect root-cause distribution
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Metrics'}
          </Button>
          <a
            href="/api/reports/export?type=yield"
            target="_blank"
            rel="noreferrer"
          >
            <Button
              size="sm"
              className="bg-emerald-600 text-xs font-semibold hover:bg-emerald-700"
            >
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
              Export Full Report (CSV)
            </Button>
          </a>
        </div>
      </div>

      {/* Yield & Scrap KPI Overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Overall Shop Yield
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {report.yield.overallYieldPercentage}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {report.yield.totalCompletedPanels} completed of{' '}
            {report.yield.totalPlannedPanels} planned
          </div>
        </Card>

        <Card className="border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-red-600">
            <AlertOctagon className="h-4 w-4 text-red-500" />
            Total Scrap Rate
          </div>
          <div className="mt-2 text-2xl font-black text-red-700">
            {report.yield.scrapRatePercentage}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {report.yield.totalScrapPanels} scrapped panels
          </div>
        </Card>

        <Card className="border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-600">
            <Boxes className="h-4 w-4 text-blue-500" />
            Logistics Pallets
          </div>
          <div className="mt-2 text-2xl font-black text-blue-700">
            {report.logistics.totalPalletsBuilt} Built
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {report.logistics.totalPalletsShipped} pallets dispatched
          </div>
        </Card>

        <Card className="border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-purple-600">
            <Truck className="h-4 w-4 text-purple-500" />
            Dispatched Freight
          </div>
          <div className="mt-2 text-2xl font-black text-purple-700">
            {report.logistics.totalWeightShippedLbs.toLocaleString()} lbs
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            across {report.logistics.totalShipmentsDispatched} flatbed loads
          </div>
        </Card>
      </div>

      {/* Main Split: Department Efficiency Table & Defect Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Department Station Throughput Table (8 cols) */}
        <div className="space-y-4 lg:col-span-8">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Station Throughput &amp; Cycle Efficiency
                </CardTitle>
                <CardDescription className="text-xs">
                  Workstep progress and scrap rate breakdown by manufacturing
                  workcell
                </CardDescription>
              </div>
              <a
                href="/api/reports/export?type=throughput"
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <FileSpreadsheet className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                  CSV
                </Button>
              </a>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="p-3">Department</th>
                      <th className="p-3 text-right">Completed</th>
                      <th className="p-3 text-right">In Progress</th>
                      <th className="p-3 text-right">Scrapped</th>
                      <th className="p-3 text-right">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.departmentThroughput.map((dept) => (
                      <tr
                        key={dept.department}
                        className="hover:bg-slate-50/50"
                      >
                        <td className="p-3 font-bold text-slate-900">
                          {dept.department}
                        </td>
                        <td className="p-3 text-right font-semibold text-emerald-700">
                          {dept.completedUnits}
                        </td>
                        <td className="p-3 text-right text-slate-600">
                          {dept.inProgressUnits}
                        </td>
                        <td className="p-3 text-right font-semibold text-red-600">
                          {dept.scrapUnits}
                        </td>
                        <td className="p-3 text-right">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold ${
                              dept.efficiencyScore >= 95
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : dept.efficiencyScore >= 85
                                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                                  : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                          >
                            {dept.efficiencyScore}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quality Defect Categories (4 cols) */}
        <div className="space-y-4 lg:col-span-4">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Defect Root Causes
                </CardTitle>
                <CardDescription className="text-xs">
                  Recurring non-conformance incidents
                </CardDescription>
              </div>
              <a
                href="/api/reports/export?type=defects"
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <FileSpreadsheet className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                  CSV
                </Button>
              </a>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {report.defectDistribution.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No quality defects recorded in the system.
                </div>
              ) : (
                report.defectDistribution.map((defect) => (
                  <div key={defect.category} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{defect.category}</span>
                      <span>
                        {defect.count} ({defect.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${defect.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
