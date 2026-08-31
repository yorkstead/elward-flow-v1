'use client'

import * as React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Cpu, Layers, Wrench, CheckCircle, Truck } from 'lucide-react'
import type { DepartmentCapacityMetric } from '@/lib/services/production'

interface DepartmentCapacityBoardProps {
  metrics: DepartmentCapacityMetric[]
  activeDepartment: string
  onSelectDepartment: (dept: string) => void
}

export function DepartmentCapacityBoard({
  metrics,
  activeDepartment,
  onSelectDepartment,
}: DepartmentCapacityBoardProps) {
  const getDeptIcon = (dept: string) => {
    switch (dept.toUpperCase()) {
      case 'CNC':
        return <Cpu className="h-5 w-5 text-blue-600" />
      case 'ELU':
        return <Layers className="h-5 w-5 text-indigo-600" />
      case 'PARTS PREP':
      case 'PARTS':
        return <Layers className="h-5 w-5 text-teal-600" />
      case 'ASSEMBLY':
        return <Wrench className="h-5 w-5 text-amber-600" />
      case 'QC':
        return <CheckCircle className="h-5 w-5 text-emerald-600" />
      case 'SHIPPING':
        return <Truck className="h-5 w-5 text-purple-600" />
      default:
        return <Layers className="h-5 w-5 text-slate-600" />
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {metrics.map((m) => {
        const isSelected =
          activeDepartment.toLowerCase() === m.department.toLowerCase()

        return (
          <Card
            key={m.department}
            onClick={() => onSelectDepartment(m.department)}
            className={`cursor-pointer transition-all hover:border-primary/60 hover:shadow-xs ${
              isSelected
                ? 'border-2 border-primary bg-primary/10 shadow-xs dark:bg-primary/15'
                : 'border-border bg-card'
            }`}
          >
            <CardHeader className="p-3.5 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    {getDeptIcon(m.department)}
                  </div>
                  <CardTitle className="text-xs font-bold text-foreground">
                    {m.department}
                  </CardTitle>
                </div>
                {m.hold > 0 && (
                  <Badge className="border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    {m.hold} Hold
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-foreground">
                  {m.totalPlanned}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    pcs
                  </span>
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {m.completed} done
                </span>
              </div>

              {m.scrap > 0 && (
                <div className="border-border mt-1.5 flex items-center justify-between border-t pt-1 text-[11px] font-medium text-destructive">
                  <span>Scrap logged:</span>
                  <span className="font-bold">{m.scrap} pcs</span>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
