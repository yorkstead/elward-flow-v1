import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'

export interface DepartmentStepProgress {
  name: string
  code: string
  department: string
  completed: number
  total: number
  hold: number
}

interface DepartmentProgressTrackerProps {
  steps: DepartmentStepProgress[]
  totalPanels: number
}

export function DepartmentProgressTracker({
  steps,
  totalPanels,
}: DepartmentProgressTrackerProps) {
  const overallCompleted =
    steps.length > 0
      ? Math.round(
          (steps.reduce(
            (acc, s) => acc + (s.total > 0 ? s.completed / s.total : 0),
            0,
          ) /
            steps.length) *
            100,
        )
      : 0

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Department Execution Pipeline
          </h2>
          <p className="text-xs text-slate-500">
            Live operational progress across fabrication stations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-600">
            Total Scope:{' '}
            <strong className="font-bold text-slate-950">
              {totalPanels} panels
            </strong>
          </span>
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800"
          >
            {overallCompleted}% Complete
          </Badge>
        </div>
      </div>

      {/* Grid of Department Progress Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {steps.map((step) => {
          const percent =
            step.total > 0
              ? Math.min(100, Math.round((step.completed / step.total) * 100))
              : 0
          const isComplete = percent === 100 && step.total > 0
          const hasHold = step.hold > 0

          return (
            <div
              key={step.code}
              className={`flex flex-col justify-between rounded-lg border p-3 transition-all ${
                hasHold
                  ? 'border-amber-300 bg-amber-50/40'
                  : isComplete
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div>
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-bold text-slate-800">
                    {step.name}
                  </span>
                  {hasHold ? (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  ) : isComplete ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  )}
                </div>

                <div className="my-1 font-mono text-lg leading-none font-black text-slate-900">
                  {step.completed}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    / {step.total}
                  </span>
                </div>
              </div>

              <div className="mt-2 space-y-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      hasHold
                        ? 'bg-amber-500'
                        : isComplete
                          ? 'bg-emerald-600'
                          : 'bg-blue-600'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                  <span>{percent}%</span>
                  {hasHold && (
                    <span className="font-bold text-amber-700">
                      {step.hold} hold
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
