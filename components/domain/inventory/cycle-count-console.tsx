'use client'

import * as React from 'react'
import {
  ClipboardCheck,
  EyeOff,
  CheckCircle2,
  Plus,
  RefreshCw,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { InventoryItemStockSummary } from '@/lib/services/inventory'

export interface CycleCountLineState {
  id: string
  itemNumber: string
  description: string
  unit: string
  systemQuantity: number
  countedQuantity: number | null
  discrepancyQuantity: number | null
}

interface CycleCountConsoleProps {
  stockItems: InventoryItemStockSummary[]
  onReconciled?: () => void
}

export function CycleCountConsole({
  stockItems,
  onReconciled,
}: CycleCountConsoleProps) {
  const [activeSession, setActiveSession] = React.useState<{
    id: string
    sessionNumber: string
    status: 'In Progress' | 'Review' | 'Closed'
    isBlind: boolean
  } | null>(null)

  const [countLines, setCountLines] = React.useState<CycleCountLineState[]>([])
  const [counts, setCounts] = React.useState<Record<string, string>>({})
  const [starting, setStarting] = React.useState(false)
  const [reconciling, setReconciling] = React.useState(false)
  const [reconcileNotes, setReconcileNotes] = React.useState('')
  const [reconcileModalOpen, setReconcileModalOpen] = React.useState(false)

  const handleStartSession = async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/inventory/cycle-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          scopeZone: 'All Warehouse',
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to start cycle count')
      }

      const data = await res.json()
      const newSessionNumber =
        data.result?.sessionNumber ||
        `CC-${new Date().toISOString().split('T')[0]}-01`
      const newSessionId = data.result?.sessionId || 'session-1'

      setActiveSession({
        id: newSessionId,
        sessionNumber: newSessionNumber,
        status: 'In Progress',
        isBlind: true,
      })

      // Populate count lines with frozen system quantities
      const lines: CycleCountLineState[] = stockItems.map((item, idx) => ({
        id: `line-${idx + 1}`,
        itemNumber: item.itemNumber,
        description: item.description,
        unit: item.unit,
        systemQuantity: item.onHandQuantity,
        countedQuantity: null,
        discrepancyQuantity: null,
      }))

      setCountLines(lines)
      setCounts({})
    } catch (err) {
      console.error(err)
    } finally {
      setStarting(false)
    }
  }

  const handleSaveCounts = () => {
    // Reveal discrepancies for review
    const updated = countLines.map((line) => {
      const countedStr = counts[line.id]
      const counted =
        countedStr !== undefined && countedStr !== ''
          ? parseFloat(countedStr)
          : line.systemQuantity
      const discrepancy = counted - line.systemQuantity
      return {
        ...line,
        countedQuantity: counted,
        discrepancyQuantity: discrepancy,
      }
    })

    setCountLines(updated)
    if (activeSession) {
      setActiveSession({
        ...activeSession,
        status: 'Review',
        isBlind: false,
      })
    }
  }

  const handleApproveReconciliation = async () => {
    if (!activeSession) return

    setReconciling(true)
    try {
      const res = await fetch('/api/inventory/cycle-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reconcile',
          sessionId: activeSession.id,
          notes:
            reconcileNotes.trim() || 'Supervisor cycle count reconciliation',
        }),
      })

      if (!res.ok) {
        console.warn('Reconcile endpoint response', res.status)
      }

      setActiveSession({
        ...activeSession,
        status: 'Closed',
      })

      setReconcileModalOpen(false)
      onReconciled?.()
    } catch (err) {
      console.error(err)
    } finally {
      setReconciling(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Blind Cycle Count & Discrepancy Reconciliation
            </h2>
            <p className="text-xs text-slate-500">
              Conduct periodic blind physical counts and approve auditable
              compensating adjustments
            </p>
          </div>
        </div>

        {!activeSession || activeSession.status === 'Closed' ? (
          <Button
            type="button"
            size="sm"
            onClick={handleStartSession}
            disabled={starting}
            className="h-8 bg-blue-600 px-3 text-xs font-bold text-white shadow-2xs hover:bg-blue-700"
          >
            {starting ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Start New Blind Count Session
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-900 text-xs font-bold text-white">
              {activeSession.sessionNumber}
            </Badge>
            <Badge
              className={
                activeSession.status === 'In Progress'
                  ? 'bg-amber-100 text-xs font-semibold text-amber-800'
                  : 'bg-purple-100 text-xs font-semibold text-purple-800'
              }
            >
              {activeSession.status === 'In Progress'
                ? 'Blind Counting'
                : 'Discrepancy Review'}
            </Badge>
          </div>
        )}
      </div>

      {!activeSession || countLines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
          No active cycle count session. Click{' '}
          <strong className="text-slate-800">
            Start New Blind Count Session
          </strong>{' '}
          to freeze stock balances and initiate floor count.
        </div>
      ) : (
        <div className="space-y-4">
          {activeSession.isBlind && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <EyeOff className="h-4 w-4 shrink-0 text-amber-700" />
              <span>
                <strong>Blind Mode Active:</strong> System quantities are frozen
                and hidden from floor operators to enforce unbiased physical
                counting.
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="font-bold">
                    Item Number & Spec
                  </TableHead>
                  <TableHead className="text-center font-bold">
                    {activeSession.isBlind ? 'System Balance' : 'Frozen System'}
                  </TableHead>
                  <TableHead className="text-center font-bold">
                    Physical Count
                  </TableHead>
                  {!activeSession.isBlind && (
                    <TableHead className="text-center font-bold">
                      Discrepancy (+/-)
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {countLines.map((line) => (
                  <TableRow key={line.id} className="text-xs">
                    <TableCell>
                      <div className="font-mono font-bold text-slate-950">
                        {line.itemNumber}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {line.description}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono font-semibold text-slate-800">
                      {activeSession.isBlind ? (
                        <span className="flex items-center justify-center gap-1 text-slate-400">
                          <Lock className="h-3 w-3" /> Blind
                        </span>
                      ) : (
                        `${line.systemQuantity} ${line.unit}`
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {activeSession.status === 'In Progress' ? (
                        <div className="mx-auto flex max-w-[120px] items-center gap-1">
                          <Input
                            aria-label={`Count for ${line.itemNumber}`}
                            type="number"
                            step="any"
                            placeholder="Enter count"
                            value={counts[line.id] ?? ''}
                            onChange={(e) =>
                              setCounts({
                                ...counts,
                                [line.id]: e.target.value,
                              })
                            }
                            className="h-8 text-center font-mono text-xs font-bold"
                          />
                          <span className="text-[10px] text-slate-500">
                            {line.unit}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono font-bold text-slate-900">
                          {line.countedQuantity} {line.unit}
                        </span>
                      )}
                    </TableCell>
                    {!activeSession.isBlind && (
                      <TableCell className="text-center font-mono font-bold">
                        {line.discrepancyQuantity === 0 ||
                        line.discrepancyQuantity === null ? (
                          <span className="text-emerald-700">0 (Match)</span>
                        ) : line.discrepancyQuantity > 0 ? (
                          <span className="text-blue-700">
                            +{line.discrepancyQuantity} {line.unit} (Overage)
                          </span>
                        ) : (
                          <span className="text-red-700">
                            {line.discrepancyQuantity} {line.unit} (Shortage)
                          </span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            {activeSession.status === 'In Progress' ? (
              <Button
                type="button"
                size="sm"
                onClick={handleSaveCounts}
                className="bg-blue-600 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Submit Counts & Review Discrepancies
              </Button>
            ) : activeSession.status === 'Review' ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setReconcileModalOpen(true)}
                className="bg-purple-700 text-xs font-bold text-white shadow-xs hover:bg-purple-800"
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Approve & Write Compensating Adjustments
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Reconciliation Complete & Closed
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reconcile Approval Modal */}
      <Dialog open={reconcileModalOpen} onOpenChange={setReconcileModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              Approve Cycle Count Reconciliation
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Approve physical count discrepancies. The system will
              automatically insert immutable compensating adjustment
              transactions into the ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-950">
              <div className="font-bold">
                Session: {activeSession?.sessionNumber}
              </div>
              <div className="mt-1 text-purple-800">
                Discrepancies identified:{' '}
                {
                  countLines.filter((l) => (l.discrepancyQuantity || 0) !== 0)
                    .length
                }{' '}
                items
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Supervisor Approval Reason / Audit Note *
              </label>
              <Input
                placeholder="e.g. Approved monthly physical warehouse cycle count"
                value={reconcileNotes}
                onChange={(e) => setReconcileNotes(e.target.value)}
                className="mt-1 h-9 text-xs"
                required
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReconcileModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={reconciling || !reconcileNotes.trim()}
              onClick={handleApproveReconciliation}
              className="bg-purple-700 text-xs font-bold text-white shadow-xs hover:bg-purple-800"
            >
              {reconciling ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Approve & Post Ledger Adjustments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
