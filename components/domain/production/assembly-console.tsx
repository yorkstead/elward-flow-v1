'use client'

import * as React from 'react'
import {
  Wrench,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProductionQueueItem } from '@/lib/services/production'

interface WorkstationOption {
  id: string
  name: string
  code: string
  department: string
}

interface AssemblyConsoleProps {
  assemblyItems: ProductionQueueItem[]
  workstations: WorkstationOption[]
  onItemUpdated?: () => void
  onUpdateItem?: (
    updated: Partial<ProductionQueueItem> & { id: string },
  ) => void
}

export function AssemblyConsole({
  assemblyItems,
  workstations,
  onItemUpdated,
  onUpdateItem,
}: AssemblyConsoleProps) {
  const [selectedBayId, setSelectedBayId] = React.useState<string>('all')
  const [activeItem, setActiveItem] =
    React.useState<ProductionQueueItem | null>(null)

  // Team Assignment Modal
  const [teamModalOpen, setTeamModalOpen] = React.useState(false)
  const [assignedTeam, setAssignedTeam] = React.useState('')
  const [stationId, setStationId] = React.useState('')
  const [submittingTeam, setSubmittingTeam] = React.useState(false)

  // QC Handoff Modal
  const [qcModalOpen, setQcModalOpen] = React.useState(false)
  const [qcQuantity, setQcQuantity] = React.useState(1)
  const [qcNotes, setQcNotes] = React.useState('')
  const [submittingQc, setSubmittingQc] = React.useState(false)

  const assemblyStations = workstations.filter(
    (w) => w.department === 'Assembly' || w.department === 'Parts Prep',
  )

  const filteredItems = assemblyItems.filter((i) => {
    if (selectedBayId !== 'all') {
      return i.assignedWorkstationId === selectedBayId
    }
    return true
  })

  const handleSaveTeamAssignment = async () => {
    if (!activeItem) return
    setSubmittingTeam(true)
    try {
      const res = await fetch('/api/production/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationInstanceId: activeItem.id,
          workstationId: stationId || undefined,
          assignedTeam: assignedTeam.trim() || undefined,
        }),
      })

      if (!res.ok) throw new Error('Failed to save team assignment')

      onUpdateItem?.({
        id: activeItem.id,
        assignedTeam: assignedTeam.trim() || null,
        assignedWorkstationId: stationId || activeItem.assignedWorkstationId,
      })

      setTeamModalOpen(false)
      onItemUpdated?.()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmittingTeam(false)
    }
  }

  const handleQcHandoff = async () => {
    if (!activeItem) return
    setSubmittingQc(true)
    try {
      const idempotencyKey = `qc-handoff-${activeItem.id}-${Date.now()}`
      const res = await fetch('/api/scanner/movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey,
          recordType: 'panel_mark',
          recordId: activeItem.markId,
          recordIdentifier: activeItem.markCode,
          operationInstanceId: activeItem.id,
          actionId: 'qc_handoff',
          sourceStatus: activeItem.status,
          destinationStatus: 'Completed',
          quantity: qcQuantity,
          condition: 'pass',
          notes: qcNotes.trim() || undefined,
          workstationId: activeItem.assignedWorkstationId || undefined,
        }),
      })

      if (!res.ok) throw new Error('Failed to execute QC handoff')
      setQcModalOpen(false)
      setQcNotes('')
      onItemUpdated?.()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmittingQc(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-amber-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Assembly Bay Execution & QC Handoff
            </h2>
            <p className="text-xs text-slate-500">
              Station dispatch, operator pair assignment, and QC inspection
              handoff
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">
            Assembly Bay:
          </label>
          <Select
            value={selectedBayId}
            onValueChange={(val) => {
              if (val) setSelectedBayId(val)
            }}
          >
            <SelectTrigger
              aria-label="Select Assembly Bay"
              className="h-8 w-44 text-xs font-semibold"
            >
              <SelectValue placeholder="All Assembly Bays" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assembly Bays</SelectItem>
              {assemblyStations.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
          No panel marks currently queued for Assembly in the selected bay.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`space-y-3 rounded-xl border p-4 shadow-2xs transition-all ${
                item.overallReady
                  ? 'border-amber-200 bg-amber-50/30 hover:border-amber-400'
                  : 'border-slate-200 bg-slate-50/50 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-base font-black text-slate-950">
                      {item.markCode}
                    </span>
                    <Badge className="border-amber-200 bg-amber-100 text-[10px] font-bold text-amber-900">
                      Rev {item.revisionLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600">
                    {item.releaseKey} • {item.jobName}
                  </p>
                </div>

                <Badge
                  className={
                    item.status === 'Completed'
                      ? 'bg-emerald-700 text-[10px] text-white'
                      : item.status === 'In progress'
                        ? 'bg-amber-600 text-[10px] text-white'
                        : 'bg-slate-200 text-[10px] text-slate-800'
                  }
                >
                  {item.status}
                </Badge>
              </div>

              {/* Material & Readiness */}
              <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Material / Color:</span>
                  <span className="font-semibold text-slate-800">
                    {item.materialFamily} ({item.color})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dimensions:</span>
                  <span className="font-mono text-slate-800">
                    {item.dimensions || 'Standard'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Assembly Qty:</span>
                  <span className="font-bold text-amber-800">
                    {item.remainingQuantity} / {item.plannedQuantity} pcs
                  </span>
                </div>
              </div>

              {/* Team Pairing */}
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-slate-500" />
                  <span className="font-medium">
                    Team:{' '}
                    <span className="font-bold text-slate-900">
                      {item.assignedTeam || 'Unassigned'}
                    </span>
                  </span>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActiveItem(item)
                    setStationId(item.assignedWorkstationId || '')
                    setAssignedTeam(item.assignedTeam || '')
                    setTeamModalOpen(true)
                  }}
                  className="h-6 text-[10px] font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Assign Team
                </Button>
              </div>

              {/* Predecessor & QC Handoff Action */}
              <div className="border-t border-slate-200/60 pt-2">
                {!item.predecessorReady ? (
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>Waiting on upstream CNC routing</span>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setActiveItem(item)
                      setQcQuantity(item.remainingQuantity || 1)
                      setQcModalOpen(true)
                    }}
                    className="h-8 w-full bg-emerald-700 text-xs font-bold text-white shadow-xs hover:bg-emerald-800"
                  >
                    Complete & Handoff to QC{' '}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team Assignment Modal */}
      <Dialog open={teamModalOpen} onOpenChange={setTeamModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              Assign Assembly Bay & Operator Pair
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Assign this mark to an assembly bench and team pair.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700">
                Assembly Bay
              </label>
              <Select
                value={stationId}
                onValueChange={(val) => {
                  if (val) setStationId(val)
                }}
              >
                <SelectTrigger
                  aria-label="Assembly Bay"
                  className="mt-1 h-9 text-xs"
                >
                  <SelectValue placeholder="Select Assembly Bay..." />
                </SelectTrigger>
                <SelectContent>
                  {assemblyStations.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Operator Pair / Team Name
              </label>
              <Input
                placeholder="e.g. Carlos M. & David K."
                value={assignedTeam}
                onChange={(e) => setAssignedTeam(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTeamModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submittingTeam}
              onClick={handleSaveTeamAssignment}
              className="bg-amber-600 text-xs font-bold text-white hover:bg-amber-700"
            >
              {submittingTeam ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QC Handoff Modal */}
      <Dialog open={qcModalOpen} onOpenChange={setQcModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              Confirm Assembly Completion & QC Handoff
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Panel mark will move to QC inspection queue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="font-bold text-slate-900">
                Mark {activeItem?.markCode} (Rev {activeItem?.revisionLabel})
              </div>
              <div className="text-slate-600">
                {activeItem?.materialFamily} • {activeItem?.dimensions}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Quantity to Handoff (pcs) *
              </label>
              <Input
                aria-label="Quantity to handoff"
                type="number"
                min={1}
                max={activeItem?.remainingQuantity || 100}
                value={qcQuantity}
                onChange={(e) =>
                  setQcQuantity(parseInt(e.target.value, 10) || 1)
                }
                className="mt-1 h-9 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">
                Assembly Notes / Rivet Spec
              </label>
              <Input
                placeholder="Optional notes for QC inspection..."
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQcModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submittingQc}
              onClick={handleQcHandoff}
              className="bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800"
            >
              {submittingQc ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Confirm QC Handoff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
