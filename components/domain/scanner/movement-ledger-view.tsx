'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  History,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
  Clock,
  User,
  MapPin,
} from 'lucide-react'

export interface MovementLedgerItem {
  id: string
  recordType: string
  recordIdentifier: string
  sourceStatus: string
  destinationStatus: string
  quantity: string
  unit: string
  condition: string
  reason?: string | null
  notes?: string | null
  actorName: string
  actingRole: string
  workstationName?: string | null
  timestamp: string
}

interface MovementLedgerViewProps {
  initialMovements: MovementLedgerItem[]
}

export function MovementLedgerView({
  initialMovements,
}: MovementLedgerViewProps) {
  const [filterText, setFilterText] = React.useState('')
  const [conditionFilter, setConditionFilter] = React.useState<string>('all')

  const filtered = initialMovements.filter((m) => {
    const matchesText =
      !filterText ||
      m.recordIdentifier.toLowerCase().includes(filterText.toLowerCase()) ||
      m.actorName.toLowerCase().includes(filterText.toLowerCase()) ||
      m.destinationStatus.toLowerCase().includes(filterText.toLowerCase()) ||
      (m.reason && m.reason.toLowerCase().includes(filterText.toLowerCase()))

    const matchesCondition =
      conditionFilter === 'all' || m.condition === conditionFilter

    return matchesText && matchesCondition
  })

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case 'pass':
        return (
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">
            <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" /> Pass
          </Badge>
        )
      case 'pass_with_note':
        return (
          <Badge className="border-blue-200 bg-blue-50 text-blue-800">
            Pass w/ Note
          </Badge>
        )
      case 'hold':
        return (
          <Badge className="border-amber-200 bg-amber-50 text-amber-800">
            <AlertTriangle className="mr-1 h-3 w-3 text-amber-600" /> Hold
          </Badge>
        )
      case 'rework':
        return (
          <Badge className="border-purple-200 bg-purple-50 text-purple-800">
            <RotateCcw className="mr-1 h-3 w-3 text-purple-600" /> Rework
          </Badge>
        )
      case 'scrap':
      case 'remake':
        return (
          <Badge className="border-red-200 bg-red-50 text-red-800">
            <AlertTriangle className="mr-1 h-3 w-3 text-red-600" />{' '}
            {condition.toUpperCase()}
          </Badge>
        )
      default:
        return <Badge variant="outline">{condition}</Badge>
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Shop Floor Movement Ledger
            </h2>
            <p className="text-xs text-slate-500">
              Chronological traceability chain of all scanned touches
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48 sm:w-64">
            <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Filter mark, user, status..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            {['all', 'pass', 'hold', 'rework', 'scrap'].map((c) => (
              <Button
                key={c}
                type="button"
                variant={conditionFilter === c ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setConditionFilter(c)}
                className={`h-7 px-2.5 text-xs font-semibold capitalize ${
                  conditionFilter === c
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
          No movement events recorded matching the filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="font-bold">Record / Mark</TableHead>
                <TableHead className="font-bold">Transition</TableHead>
                <TableHead className="font-bold">Quantity</TableHead>
                <TableHead className="font-bold">Condition</TableHead>
                <TableHead className="font-bold">Operator & Station</TableHead>
                <TableHead className="font-bold">Timestamp</TableHead>
                <TableHead className="font-bold">Reason / Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id} className="text-xs">
                  <TableCell className="font-bold text-slate-950">
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800">
                      {item.recordIdentifier}
                    </span>
                    <span className="ml-1.5 text-xs text-slate-600 capitalize">
                      ({item.recordType.replace('_', ' ')})
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="text-slate-600">
                        {item.sourceStatus}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="font-bold text-blue-700">
                        {item.destinationStatus}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono font-bold text-slate-900">
                    {item.quantity} {item.unit}
                  </TableCell>
                  <TableCell>{getConditionBadge(item.condition)}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 font-semibold text-slate-800">
                        <User className="h-3 w-3 text-slate-500" />
                        <span>{item.actorName}</span>
                        <span className="text-xs text-slate-600">
                          ({item.actingRole})
                        </span>
                      </div>
                      {item.workstationName && (
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <MapPin className="h-2.5 w-2.5 text-slate-500" />
                          <span>{item.workstationName}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-slate-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-500" />
                      <span>
                        {new Date(item.timestamp).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true,
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      {new Date(item.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {item.reason ? (
                      <span className="font-medium text-amber-800">
                        {item.reason}
                      </span>
                    ) : item.notes ? (
                      <span className="text-slate-600">{item.notes}</span>
                    ) : (
                      <span className="text-slate-400 italic">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
