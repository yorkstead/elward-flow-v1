import * as React from 'react'
import { AlertTriangle, CheckCircle, PackageX, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export interface BlockerItem {
  id: string
  type: 'material_shortage' | 'qc_hold' | 'drawing_conflict' | 'revision_impact'
  title: string
  description: string
  owner?: string
  severity: 'critical' | 'warning' | 'info'
}

interface BlockersExceptionsCardProps {
  blockers: BlockerItem[]
}

export function BlockersExceptionsCard({
  blockers,
}: BlockersExceptionsCardProps) {
  if (blockers.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-emerald-50/40 bg-white p-4 text-emerald-800 shadow-xs sm:p-5">
        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-bold">No Active Blockers or Holds</p>
          <p className="text-xs text-slate-600">
            Material readiness is satisfied and all marks are clear to proceed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-bold text-slate-900">
            Blockers & Owned Exceptions
          </h2>
        </div>
        <Badge className="border-0 bg-amber-700 px-2 py-0.5 text-xs font-semibold text-white">
          {blockers.length} Active {blockers.length === 1 ? 'Issue' : 'Issues'}
        </Badge>
      </div>

      <div className="divide-y divide-slate-100">
        {blockers.map((item) => (
          <div key={item.id} className="flex items-start gap-3 py-2.5">
            <div className="mt-0.5 shrink-0 rounded-md bg-amber-100/70 p-1.5 text-amber-900">
              {item.type === 'material_shortage' ? (
                <PackageX className="h-4 w-4 text-amber-800" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-red-700" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-950">
                  {item.title}
                </span>
                {item.owner && (
                  <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[11px] text-slate-800">
                    Owner:{' '}
                    <strong className="font-bold text-slate-950">
                      {item.owner}
                    </strong>
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-700">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
