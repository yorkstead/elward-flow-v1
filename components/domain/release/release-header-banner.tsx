import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Clock,
  Layers,
  Star,
} from 'lucide-react'

export interface ReleaseHeaderBannerProps {
  jobNumber: string
  releaseNumber: number
  revisionLabel: string
  revisionNumber: number
  customerName: string
  projectName: string
  status: string
  priority: number
  requiredDate?: Date | string | null
  plannedShipDate?: Date | string | null
  isCurrentRevision: boolean
}

export function ReleaseHeaderBanner({
  jobNumber,
  releaseNumber,
  revisionLabel,
  revisionNumber,
  customerName,
  projectName,
  status,
  priority,
  requiredDate,
  plannedShipDate,
  isCurrentRevision,
}: ReleaseHeaderBannerProps) {
  const formatDate = (dateVal?: Date | string | null) => {
    if (!dateVal) return 'Not scheduled'
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal
    return d.toLocaleDateString('en-US', {
      timeZone: 'America/Denver',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-4 sm:p-6">
        {/* Primary Identification */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-slate-700 uppercase">
              Job {jobNumber} • Release {releaseNumber}
            </span>
            <Badge
              variant="outline"
              className="border-blue-300 bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-900"
            >
              Key: {jobNumber}-{releaseNumber}
            </Badge>
            <Badge
              className={`px-2 py-0.5 text-xs font-semibold ${
                status === 'Approved for production' ||
                status === 'In production'
                  ? 'bg-emerald-700 text-white'
                  : status === 'Material hold' || status === 'QC hold'
                    ? 'bg-amber-700 text-white'
                    : 'bg-slate-800 text-white'
              }`}
            >
              {status}
            </Badge>
            {priority > 0 && (
              <Badge
                variant="secondary"
                className="flex items-center gap-1 border-purple-200 bg-purple-100 text-purple-800"
              >
                <Star className="h-3 w-3 fill-purple-700 text-purple-700" />
                Priority {priority}
              </Badge>
            )}
          </div>

          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {projectName}
          </h1>
          <p className="text-sm font-medium text-slate-600">
            Customer:{' '}
            <span className="font-semibold text-slate-900">{customerName}</span>
          </p>
        </div>

        {/* Current Revision Callout Banner */}
        <div className="flex flex-col items-start sm:items-end">
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${
              isCurrentRevision
                ? 'border-emerald-300 bg-emerald-50/90 text-emerald-950'
                : 'border-red-300 bg-red-50 text-red-950'
            }`}
          >
            {isCurrentRevision ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 shrink-0 text-red-600" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider uppercase">
                  Revision
                </span>
                <span className="font-mono text-lg font-black">
                  Rev {revisionNumber} ({revisionLabel})
                </span>
              </div>
              <p className="text-[11px] font-semibold">
                {isCurrentRevision
                  ? 'CURRENT — Approved for Shop Floor'
                  : 'SUPERSEDED — Do Not Fabricate'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Meta Bar: Dates & Times */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-600 sm:px-6">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>
              Required Date:{' '}
              <strong className="text-slate-900">
                {formatDate(requiredDate)}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>
              Planned Ship:{' '}
              <strong className="text-slate-900">
                {formatDate(plannedShipDate || requiredDate)}
              </strong>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <Layers className="h-4 w-4 text-slate-400" />
          <span>Active Command Center • Pinned Release</span>
        </div>
      </div>
    </div>
  )
}
