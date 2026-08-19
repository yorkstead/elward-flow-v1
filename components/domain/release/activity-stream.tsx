import * as React from 'react'
import { History, Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export interface ActivityItem {
  id: string
  actionTitle: string
  summary: string
  actorName: string
  actorRole: string
  timestamp: string
}

interface ActivityStreamProps {
  activities: ActivityItem[]
}

export function ActivityStream({ activities }: ActivityStreamProps) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-600" />
          <h2 className="text-sm font-bold text-slate-900">
            Recent Consequential Activity
          </h2>
        </div>
        <Badge variant="outline" className="text-xs font-normal text-slate-500">
          Append-Only Ledger
        </Badge>
      </div>

      <div className="divide-y divide-slate-100">
        {activities.map((item) => (
          <div key={item.id} className="flex items-start gap-3 py-2.5">
            <div className="mt-1 shrink-0 rounded-full bg-slate-100 p-1 text-slate-600">
              <Activity className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-900">
                  {item.actionTitle}
                </span>
                <span className="font-mono text-[11px] text-slate-600">
                  {item.timestamp}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-700">{item.summary}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600">
                <span>
                  By:{' '}
                  <strong className="font-medium text-slate-900">
                    {item.actorName}
                  </strong>
                </span>
                <span>•</span>
                <span className="py-0.2 rounded bg-slate-100 px-1.5 font-mono text-[10px] text-slate-700">
                  {item.actorRole}
                </span>
              </div>
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <div className="py-4 text-center text-xs text-slate-600">
            No activity recorded yet for this release.
          </div>
        )}
      </div>
    </div>
  )
}
