'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Download, Layers } from 'lucide-react'

export interface PanelMarkRow {
  id: string
  mark: string
  description?: string | null
  quantity: number
  materialFamily: string
  color?: string | null
  thickness?: string | null
  width?: string | null
  length?: string | null
  dimensionUnit: string
  currentStage: string
  status: 'Ready' | 'In progress' | 'Completed' | 'QC hold' | 'Pending'
}

interface PanelMarksTableProps {
  marks: PanelMarkRow[]
  jobNumber: string
  releaseNumber: number
}

export function PanelMarksTable({
  marks,
  jobNumber,
  releaseNumber,
}: PanelMarksTableProps) {
  const [filter, setFilter] = React.useState('')

  const filteredMarks = React.useMemo(() => {
    if (!filter.trim()) return marks
    const term = filter.toLowerCase()
    return marks.filter(
      (m) =>
        m.mark.toLowerCase().includes(term) ||
        (m.description && m.description.toLowerCase().includes(term)) ||
        m.materialFamily.toLowerCase().includes(term) ||
        (m.color && m.color.toLowerCase().includes(term)) ||
        m.currentStage.toLowerCase().includes(term),
    )
  }, [marks, filter])

  const exportCSV = () => {
    const sanitize = (val: string | number | undefined | null) => {
      const str = String(val ?? '')
      // Neutralize formula injection
      if (/^[=+\-@]/.test(str)) {
        return `"'${str.replace(/"/g, '""')}"`
      }
      return `"${str.replace(/"/g, '""')}"`
    }

    const headers = [
      'Mark',
      'Description',
      'Quantity',
      'Material',
      'Color',
      'Width (in)',
      'Length (in)',
      'Stage',
      'Status',
    ]
    const rows = filteredMarks.map((m) => [
      sanitize(m.mark),
      sanitize(m.description),
      sanitize(m.quantity),
      sanitize(m.materialFamily),
      sanitize(m.color),
      sanitize(m.width),
      sanitize(m.length),
      sanitize(m.currentStage),
      sanitize(m.status),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Job-${jobNumber}-Release-${releaseNumber}-Marks.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getStatusBadge = (status: PanelMarkRow['status']) => {
    switch (status) {
      case 'Completed':
        return (
          <Badge className="bg-emerald-700 text-[11px] text-white">
            Completed
          </Badge>
        )
      case 'QC hold':
        return (
          <Badge
            variant="destructive"
            className="bg-red-700 text-[11px] text-white"
          >
            QC Hold
          </Badge>
        )
      case 'In progress':
        return (
          <Badge className="bg-blue-700 text-[11px] text-white">
            In Progress
          </Badge>
        )
      case 'Ready':
        return (
          <Badge
            variant="outline"
            className="border-blue-300 bg-blue-50 text-[11px] text-blue-800"
          >
            Ready
          </Badge>
        )
      default:
        return (
          <Badge
            variant="secondary"
            className="bg-slate-100 text-[11px] text-slate-700"
          >
            Pending
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-slate-600" />
          <h2 className="text-sm font-bold text-slate-900">
            Panel Marks Master
          </h2>
          <span className="text-xs text-slate-500">
            ({filteredMarks.length} of {marks.length} marks)
          </span>
        </div>

        <div className="flex max-w-sm flex-1 items-center justify-end gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Filter marks, material, color..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 border-slate-200 bg-white pl-8 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            className="flex h-8 shrink-0 items-center gap-1.5 border-slate-200 bg-white text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Desktop Data Table */}
      <div
        className="hidden overflow-x-auto md:block"
        tabIndex={0}
        role="region"
        aria-label="Panel Marks Data Table"
      >
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Mark ID</th>
              <th className="px-4 py-2.5">Description</th>
              <th className="px-4 py-2.5 text-center">Qty</th>
              <th className="px-4 py-2.5">Material</th>
              <th className="px-4 py-2.5">Color / Finish</th>
              <th className="px-4 py-2.5">Dimensions (in)</th>
              <th className="px-4 py-2.5">Current Stage</th>
              <th className="px-4 py-2.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredMarks.map((row) => (
              <tr
                key={row.id}
                className="transition-colors hover:bg-slate-50/80"
              >
                <td className="px-4 py-3 font-mono font-bold text-slate-900">
                  {row.mark}
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600">
                  {row.description || '—'}
                </td>
                <td className="px-4 py-3 text-center font-mono font-bold text-slate-900">
                  {row.quantity}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {row.materialFamily}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {row.color || 'Standard'}
                </td>
                <td className="px-4 py-3 font-mono text-slate-700">
                  {row.width && row.length
                    ? `${parseFloat(row.width).toFixed(1)}" × ${parseFloat(row.length).toFixed(1)}"`
                    : '—'}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {row.currentStage}
                </td>
                <td className="px-4 py-3 text-right">
                  {getStatusBadge(row.status)}
                </td>
              </tr>
            ))}
            {filteredMarks.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  No panel marks match the filter query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Touch Cards View (Zero horizontal scroll) */}
      <div className="divide-y divide-slate-100 p-2 md:hidden">
        {filteredMarks.map((row) => (
          <div
            key={row.id}
            className="mb-2 space-y-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-black text-slate-900">
                {row.mark}
              </span>
              {getStatusBadge(row.status)}
            </div>
            <p className="text-xs text-slate-600">
              {row.description || 'Panel Mark'}
            </p>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-1 text-xs text-slate-600">
              <div>
                Qty: <strong className="text-slate-900">{row.quantity}</strong>
              </div>
              <div>
                Material:{' '}
                <strong className="text-slate-900">{row.materialFamily}</strong>
              </div>
              <div>
                Color:{' '}
                <strong className="text-slate-900">
                  {row.color || 'Standard'}
                </strong>
              </div>
              <div>
                Stage:{' '}
                <strong className="text-slate-900">{row.currentStage}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
