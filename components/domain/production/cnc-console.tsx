'use client'

import * as React from 'react'
import { Cpu, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react'
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
import type {
  ProductionQueueItem,
  FirstOffResult,
} from '@/lib/services/production'

interface WorkstationOption {
  id: string
  name: string
  code: string
  department: string
}

interface CncConsoleProps {
  cncItems: ProductionQueueItem[]
  workstations: WorkstationOption[]
  onItemUpdated?: () => void
  onUpdateItem?: (
    updated: Partial<ProductionQueueItem> & { id: string },
  ) => void
}

export function CncConsole({
  cncItems,
  workstations,
  onItemUpdated,
  onUpdateItem,
}: CncConsoleProps) {
  const [selectedMachineId, setSelectedMachineId] =
    React.useState<string>('all')
  const [activeItem, setActiveItem] =
    React.useState<ProductionQueueItem | null>(null)

  // First-off Modal
  const [firstOffModalOpen, setFirstOffModalOpen] = React.useState(false)
  const [firstOffResult, setFirstOffResult] =
    React.useState<FirstOffResult>('passed')
  const [firstOffNotes, setFirstOffNotes] = React.useState('')
  const [submittingFirstOff, setSubmittingFirstOff] = React.useState(false)

  // Machine Program Modal
  const [programModalOpen, setProgramModalOpen] = React.useState(false)
  const [machineRef, setMachineRef] = React.useState('')
  const [layoutRef, setLayoutRef] = React.useState('')
  const [stationId, setStationId] = React.useState('')
  const [submittingProgram, setSubmittingProgram] = React.useState(false)

  const cncStations = workstations.filter((w) => w.department === 'CNC')

  const filteredItems = cncItems.filter((i) => {
    if (selectedMachineId !== 'all') {
      return i.assignedWorkstationId === selectedMachineId
    }
    return true
  })

  const handleRecordFirstOff = async () => {
    if (!activeItem) return
    setSubmittingFirstOff(true)
    try {
      const res = await fetch('/api/production/first-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationInstanceId: activeItem.id,
          result: firstOffResult,
          notes: firstOffNotes.trim() || undefined,
        }),
      })

      if (!res.ok) throw new Error('Failed to record first-off inspection')

      onUpdateItem?.({
        id: activeItem.id,
        firstOffInspection: firstOffResult,
        firstOffNotes: firstOffNotes.trim() || null,
      })

      setFirstOffModalOpen(false)
      setFirstOffNotes('')
      onItemUpdated?.()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmittingFirstOff(false)
    }
  }

  const handleSaveProgramReference = async () => {
    if (!activeItem) return
    setSubmittingProgram(true)
    try {
      const res = await fetch('/api/production/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationInstanceId: activeItem.id,
          workstationId: stationId || undefined,
          machineReference: machineRef.trim() || undefined,
          layoutReference: layoutRef.trim() || undefined,
        }),
      })

      if (!res.ok) throw new Error('Failed to save program reference')
      setProgramModalOpen(false)
      onItemUpdated?.()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmittingProgram(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              CNC Routing Execution Console
            </h2>
            <p className="text-xs text-slate-500">
              CNT Motion machine queues, WinCNC references, and first-off
              inspections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">
            Machine:
          </label>
          <Select
            value={selectedMachineId}
            onValueChange={(val) => {
              if (val) setSelectedMachineId(val)
            }}
          >
            <SelectTrigger
              aria-label="Select CNC machine"
              className="h-8 w-44 text-xs font-semibold"
            >
              <SelectValue placeholder="All CNC Machines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All CNC Machines</SelectItem>
              {cncStations.map((s) => (
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
          No panel marks currently queued for CNC routing on selected machine.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`space-y-3 rounded-xl border p-4 shadow-2xs transition-all ${
                item.overallReady
                  ? 'border-blue-200 bg-blue-50/30 hover:border-blue-400'
                  : 'border-slate-200 bg-slate-50/50 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-base font-black text-slate-950">
                      {item.markCode}
                    </span>
                    <Badge className="border-blue-200 bg-blue-100 text-[10px] font-bold text-blue-900">
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
                        ? 'bg-blue-600 text-[10px] text-white'
                        : 'bg-slate-200 text-[10px] text-slate-800'
                  }
                >
                  {item.status}
                </Badge>
              </div>

              {/* Material & Specs */}
              <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Material:</span>
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
                  <span className="text-slate-500">Remaining Qty:</span>
                  <span className="font-bold text-blue-700">
                    {item.remainingQuantity} / {item.plannedQuantity} pcs
                  </span>
                </div>
              </div>

              {/* Machine & WinCNC References */}
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2 text-[11px] text-slate-600">
                <div>
                  <div className="font-medium">
                    Station:{' '}
                    <span className="font-bold text-slate-900">
                      {item.assignedWorkstationCode || 'Unassigned'}
                    </span>
                  </div>
                  {item.machineReference && (
                    <div className="font-mono text-[10px] text-slate-500">
                      Prog: {item.machineReference}
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActiveItem(item)
                    setStationId(item.assignedWorkstationId || '')
                    setMachineRef(item.machineReference || '')
                    setLayoutRef(item.layoutReference || '')
                    setProgramModalOpen(true)
                  }}
                  className="h-6 text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Setup WinCNC
                </Button>
              </div>

              {/* First-Off Inspection Status */}
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-600">
                    First-Off:
                  </span>
                  {item.firstOffInspection === 'passed' ? (
                    <Badge className="bg-emerald-700 text-[10px] text-white">
                      Passed
                    </Badge>
                  ) : item.firstOffInspection === 'failed' ? (
                    <Badge className="bg-red-700 text-[10px] text-white">
                      Failed
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-slate-500"
                    >
                      Pending
                    </Badge>
                  )}
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setActiveItem(item)
                    setFirstOffResult(
                      item.firstOffInspection === 'pending'
                        ? 'passed'
                        : item.firstOffInspection,
                    )
                    setFirstOffNotes(item.firstOffNotes || '')
                    setFirstOffModalOpen(true)
                  }}
                  className="h-7 text-xs font-semibold text-slate-800"
                >
                  <Sparkles className="mr-1 h-3 w-3 text-amber-600" />
                  Inspect First-Off
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* First-Off Modal */}
      <Dialog open={firstOffModalOpen} onOpenChange={setFirstOffModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              First-Off Inspection — Mark {activeItem?.markCode}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Verify dimensions, routing kerf, folding tabs, and surface finish
              before completing full batch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700">
                Inspection Result *
              </label>
              <Select
                value={firstOffResult}
                onValueChange={(val) => {
                  if (val) setFirstOffResult(val as FirstOffResult)
                }}
              >
                <SelectTrigger
                  aria-label="First-Off Result"
                  className="mt-1 h-9 text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passed">
                    Pass (Conforms to drawing)
                  </SelectItem>
                  <SelectItem value="passed_with_note">
                    Pass with Note (Minor non-critical variance)
                  </SelectItem>
                  <SelectItem value="failed">
                    Fail (Requires tool compensation / remake)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Inspection Notes / Measured Dims
              </label>
              <Input
                placeholder="e.g. Dimensions verified with digital caliper (+0.015 in)"
                value={firstOffNotes}
                onChange={(e) => setFirstOffNotes(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFirstOffModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submittingFirstOff}
              onClick={handleRecordFirstOff}
              className="bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800"
            >
              {submittingFirstOff ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save First-Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Program Reference Modal */}
      <Dialog open={programModalOpen} onOpenChange={setProgramModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              WinCNC & Table Setup — Mark {activeItem?.markCode}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Set machine assignment and CNC G-code program file reference.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700">
                Machine Assignment
              </label>
              <Select
                value={stationId}
                onValueChange={(val) => {
                  if (val) setStationId(val)
                }}
              >
                <SelectTrigger
                  aria-label="CNC Machine"
                  className="mt-1 h-9 text-xs"
                >
                  <SelectValue placeholder="Select CNC machine..." />
                </SelectTrigger>
                <SelectContent>
                  {cncStations.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                WinCNC Program File (.tap / .nc)
              </label>
              <Input
                placeholder="e.g. 25036_1_P101_ACM.tap"
                value={machineRef}
                onChange={(e) => setMachineRef(e.target.value)}
                className="mt-1 h-9 font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Table & Layout Reference
              </label>
              <Input
                placeholder="e.g. Table 1 - Layout 2 (2 panels/sheet)"
                value={layoutRef}
                onChange={(e) => setLayoutRef(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setProgramModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submittingProgram}
              onClick={handleSaveProgramReference}
              className="bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
            >
              {submittingProgram ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save Program Reference
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
